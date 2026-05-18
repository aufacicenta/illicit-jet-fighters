import { clearPendingForFighter, sendToFighter } from "../ws/store";
import {
  generateCharacterDescription,
  generateCharacterDescriptionRefine,
  generateSpecsheetImage,
  generateSpecsheetPrompt,
  generateSpecsheetPromptRefine,
} from "./generate";
import { withFighterContext as withContext } from "./log-context";
import { logger } from "./logger";
import { deriveSectionStatuses } from "./pipeline-status";
import type { ChatMessage, SectionId, SectionOutput } from "./types";

type FighterPipelineState = {
  outputs: Partial<Record<SectionId, SectionOutput>>;
  histories: Partial<Record<SectionId, ChatMessage[]>>;
  activeSectionId: SectionId | null;
  lastErrorSectionId: SectionId | null;
  gateMessage: string | null;
};

const stepOrder: SectionId[] = ["character-description", "specsheet-prompt", "specsheet-image"];

const stateByFighter = new Map<string, FighterPipelineState>();

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const getState = (fighterId: string, correlationId?: string): FighterPipelineState => {
  const current = stateByFighter.get(fighterId);
  if (current) {
    logger.debug("pipeline state loaded", withContext(fighterId, correlationId));
    return current;
  }

  const created: FighterPipelineState = {
    outputs: {},
    histories: {},
    activeSectionId: null,
    lastErrorSectionId: null,
    gateMessage: null,
  };
  stateByFighter.set(fighterId, created);
  logger.info("pipeline state created", withContext(fighterId, correlationId));
  return created;
};

const nowIso = () => new Date().toISOString();

const setOutput = (
  fighterId: string,
  sectionId: SectionId,
  content: string,
  model: string,
  mimeType?: string,
  correlationId?: string,
) => {
  const state = getState(fighterId, correlationId);
  state.outputs[sectionId] = {
    sectionId,
    content,
    generatedAt: nowIso(),
    model,
    mimeType,
  };
  logger.debug("pipeline output stored", {
    ...withContext(fighterId, correlationId),
    ...{ sectionId, model, mimeType, contentLength: content.length },
  });
};

const setHistory = (
  fighterId: string,
  sectionId: SectionId,
  history: ChatMessage[],
  correlationId?: string,
) => {
  const state = getState(fighterId, correlationId);
  state.histories[sectionId] = history;
  logger.debug("pipeline history stored", {
    ...withContext(fighterId, correlationId),
    ...{ sectionId, historyLength: history.length },
  });
};

const resetDownstream = (fighterId: string, sectionId: SectionId, correlationId?: string) => {
  const state = getState(fighterId, correlationId);
  const startIdx = stepOrder.indexOf(sectionId);
  const downstream = stepOrder.slice(startIdx + 1);

  for (const step of downstream) {
    delete state.outputs[step];
    delete state.histories[step];
  }

  logger.info("pipeline downstream reset", {
    ...withContext(fighterId, correlationId),
    ...{ sectionId, clearedSections: downstream },
  });
};

const buildSyncMessage = (state: FighterPipelineState) => ({
  type: "pipeline:sync" as const,
  sectionStatuses: deriveSectionStatuses({
    outputs: state.outputs,
    activeSectionId: state.activeSectionId,
    lastErrorSectionId: state.lastErrorSectionId,
  }),
  outputs: state.outputs,
  histories: state.histories,
  gateMessage: state.gateMessage,
});

export const syncPipelineState = (fighterId: string) => {
  const state = stateByFighter.get(fighterId);
  if (!state) {
    return;
  }

  sendToFighter(fighterId, buildSyncMessage(state));
};

const emitSectionError = (
  fighterId: string,
  sectionId: SectionId,
  error: unknown,
  correlationId?: string,
) => {
  const state = getState(fighterId, correlationId);
  const errorMessage = error instanceof Error ? error.message : "Unknown pipeline error.";
  state.activeSectionId = null;
  state.lastErrorSectionId = sectionId;
  sendToFighter(fighterId, {
    type: "section:error",
    sectionId,
    error: errorMessage,
  });
};

const runSpecsheetImageStep = async (
  fighterId: string,
  prompt: string,
  correlationId?: string,
  startedAt?: number,
) => {
  const state = getState(fighterId, correlationId);
  const imageStartedAt = Date.now();
  state.activeSectionId = "specsheet-image";
  sendToFighter(fighterId, { type: "section:start", sectionId: "specsheet-image" });

  const image = await generateSpecsheetImage(prompt);
  setOutput(
    fighterId,
    "specsheet-image",
    image.imageBase64,
    image.model,
    image.mimeType,
    correlationId,
  );
  sendToFighter(fighterId, {
    type: "section:complete",
    sectionId: "specsheet-image",
    output: state.outputs["specsheet-image"]!,
  });
  logger.info("pipeline section completed", {
    ...withContext(fighterId, correlationId),
    ...{
      sectionId: "specsheet-image",
      durationMs: Date.now() - imageStartedAt,
      model: image.model,
      mimeType: image.mimeType,
    },
  });

  state.activeSectionId = null;
  state.gateMessage =
    "Character description and specsheet are ready. Continue generating remaining assets?";
  sendToFighter(fighterId, {
    type: "pipeline:gate",
    sectionId: "specsheet-image",
    message: state.gateMessage,
  });
  logger.info("pipeline gate emitted", {
    ...withContext(fighterId, correlationId),
    ...{
      sectionId: "specsheet-image",
      totalDurationMs: startedAt ? Date.now() - startedAt : Date.now() - imageStartedAt,
    },
  });
};

export const startPipeline = async (fighterId: string, prompt: string, correlationId?: string) => {
  const startedAt = Date.now();
  logger.info("pipeline start requested", {
    ...withContext(fighterId, correlationId),
    ...{ promptLength: prompt.length },
  });

  clearPendingForFighter(fighterId);

  const state = getState(fighterId, correlationId);
  state.outputs = {};
  state.histories = {};
  state.activeSectionId = null;
  state.lastErrorSectionId = null;
  state.gateMessage = null;
  logger.debug("pipeline state cleared", withContext(fighterId, correlationId));

  try {
    const characterStartedAt = Date.now();
    state.activeSectionId = "character-description";
    sendToFighter(fighterId, {
      type: "section:start",
      sectionId: "character-description",
    });

    const character = await generateCharacterDescription(prompt);
    setOutput(
      fighterId,
      "character-description",
      character.markdown,
      character.model,
      undefined,
      correlationId,
    );
    setHistory(
      fighterId,
      "character-description",
      [
        { role: "user", content: prompt },
        { role: "assistant", content: character.markdown },
      ],
      correlationId,
    );
    sendToFighter(fighterId, {
      type: "section:complete",
      sectionId: "character-description",
      output: state.outputs["character-description"]!,
    });
    logger.info("pipeline section completed", {
      ...withContext(fighterId, correlationId),
      ...{
        sectionId: "character-description",
        durationMs: Date.now() - characterStartedAt,
        model: character.model,
      },
    });

    state.activeSectionId = null;

    const promptStartedAt = Date.now();
    state.activeSectionId = "specsheet-prompt";
    sendToFighter(fighterId, { type: "section:start", sectionId: "specsheet-prompt" });
    const specPrompt = await generateSpecsheetPrompt(character.markdown);
    setOutput(
      fighterId,
      "specsheet-prompt",
      specPrompt.prompt,
      specPrompt.model,
      undefined,
      correlationId,
    );
    setHistory(
      fighterId,
      "specsheet-prompt",
      [
        { role: "user", content: character.markdown },
        { role: "assistant", content: specPrompt.prompt },
      ],
      correlationId,
    );
    sendToFighter(fighterId, {
      type: "section:complete",
      sectionId: "specsheet-prompt",
      output: state.outputs["specsheet-prompt"]!,
    });
    logger.info("pipeline section completed", {
      ...withContext(fighterId, correlationId),
      ...{
        sectionId: "specsheet-prompt",
        durationMs: Date.now() - promptStartedAt,
        model: specPrompt.model,
      },
    });

    state.activeSectionId = null;

    await runSpecsheetImageStep(fighterId, specPrompt.prompt, correlationId, startedAt);
  } catch (error) {
    logger.error("pipeline start failed", {
      ...withContext(fighterId, correlationId),
      ...{ durationMs: Date.now() - startedAt, error: getErrorMessage(error) },
    });
    emitSectionError(
      fighterId,
      getState(fighterId, correlationId).activeSectionId ?? "character-description",
      error,
      correlationId,
    );
  }
};

export const generateSpecsheetFromCharacterDescription = async (
  fighterId: string,
  characterDescription: string,
  correlationId?: string,
) => {
  const startedAt = Date.now();
  logger.info("pipeline specsheet generation requested", {
    ...withContext(fighterId, correlationId),
    ...{ descriptionLength: characterDescription.length },
  });

  const state = getState(fighterId, correlationId);
  state.gateMessage = null;
  state.lastErrorSectionId = null;

  try {
    const promptStartedAt = Date.now();
    state.activeSectionId = "specsheet-prompt";
    sendToFighter(fighterId, { type: "section:start", sectionId: "specsheet-prompt" });

    const specPrompt = await generateSpecsheetPrompt(characterDescription);
    setOutput(
      fighterId,
      "specsheet-prompt",
      specPrompt.prompt,
      specPrompt.model,
      undefined,
      correlationId,
    );
    setHistory(
      fighterId,
      "specsheet-prompt",
      [
        { role: "user", content: characterDescription },
        { role: "assistant", content: specPrompt.prompt },
      ],
      correlationId,
    );
    sendToFighter(fighterId, {
      type: "section:complete",
      sectionId: "specsheet-prompt",
      output: state.outputs["specsheet-prompt"]!,
    });
    logger.info("pipeline section completed", {
      ...withContext(fighterId, correlationId),
      ...{
        sectionId: "specsheet-prompt",
        durationMs: Date.now() - promptStartedAt,
        model: specPrompt.model,
      },
    });

    await runSpecsheetImageStep(fighterId, specPrompt.prompt, correlationId, startedAt);
  } catch (error) {
    logger.error("pipeline specsheet generation failed", {
      ...withContext(fighterId, correlationId),
      ...{ durationMs: Date.now() - startedAt, error: getErrorMessage(error) },
    });
    emitSectionError(
      fighterId,
      getState(fighterId, correlationId).activeSectionId ?? "specsheet-prompt",
      error,
      correlationId,
    );
  }
};

export const continuePipeline = (fighterId: string, correlationId?: string) => {
  logger.info("pipeline continue requested", withContext(fighterId, correlationId));
  const state = getState(fighterId, correlationId);
  state.gateMessage = null;
  sendToFighter(fighterId, { type: "pipeline:complete" });
  logger.info("pipeline marked complete", withContext(fighterId, correlationId));
};

export const refineSection = async (
  fighterId: string,
  sectionId: SectionId,
  message: string,
  history: ChatMessage[],
  correlationId?: string,
) => {
  const startedAt = Date.now();
  logger.info("pipeline refine requested", {
    ...withContext(fighterId, correlationId),
    ...{ sectionId, messageLength: message.length, historyLength: history.length },
  });
  const state = getState(fighterId, correlationId);
  state.activeSectionId = sectionId;
  state.lastErrorSectionId = null;
  sendToFighter(fighterId, { type: "section:start", sectionId });

  try {
    if (sectionId === "character-description") {
      const refined = await generateCharacterDescriptionRefine(history, message);
      setOutput(fighterId, sectionId, refined.markdown, refined.model, undefined, correlationId);
      setHistory(
        fighterId,
        sectionId,
        [
          ...history,
          { role: "user", content: message },
          { role: "assistant", content: refined.markdown },
        ],
        correlationId,
      );
      logger.info("pipeline refine generated", {
        ...withContext(fighterId, correlationId),
        ...{ sectionId, model: refined.model },
      });
    } else if (sectionId === "specsheet-prompt") {
      const refined = await generateSpecsheetPromptRefine(history, message);
      setOutput(fighterId, sectionId, refined.prompt, refined.model, undefined, correlationId);
      setHistory(
        fighterId,
        sectionId,
        [
          ...history,
          { role: "user", content: message },
          { role: "assistant", content: refined.prompt },
        ],
        correlationId,
      );
      logger.info("pipeline refine generated", {
        ...withContext(fighterId, correlationId),
        ...{ sectionId, model: refined.model },
      });
    } else {
      const generated = await generateSpecsheetImage(message);
      setOutput(
        fighterId,
        sectionId,
        generated.imageBase64,
        generated.model,
        generated.mimeType,
        correlationId,
      );
      logger.info("pipeline refine generated", {
        ...withContext(fighterId, correlationId),
        ...{ sectionId, model: generated.model, mimeType: generated.mimeType },
      });
    }

    resetDownstream(fighterId, sectionId, correlationId);

    const output = getState(fighterId, correlationId).outputs[sectionId];
    if (!output) {
      throw new Error("Missing refined output.");
    }

    state.activeSectionId = null;
    sendToFighter(fighterId, { type: "section:complete", sectionId, output });

    if (sectionId === "specsheet-prompt") {
      try {
        await runSpecsheetImageStep(fighterId, output.content, correlationId);
      } catch (imageError) {
        logger.error("pipeline auto image generation failed after refine", {
          ...withContext(fighterId, correlationId),
          ...{
            sectionId: "specsheet-image",
            durationMs: Date.now() - startedAt,
            error: getErrorMessage(imageError),
          },
        });
        emitSectionError(fighterId, "specsheet-image", imageError, correlationId);
      }
    }

    logger.info("pipeline refine completed", {
      ...withContext(fighterId, correlationId),
      ...{ sectionId, durationMs: Date.now() - startedAt },
    });
  } catch (error) {
    logger.error("pipeline refine failed", {
      ...withContext(fighterId, correlationId),
      ...{ sectionId, durationMs: Date.now() - startedAt, error: getErrorMessage(error) },
    });
    emitSectionError(fighterId, sectionId, error, correlationId);
  }
};

export const editSection = async (
  fighterId: string,
  sectionId: SectionId,
  content: string,
  correlationId?: string,
) => {
  const startedAt = Date.now();
  logger.info("pipeline edit requested", {
    ...withContext(fighterId, correlationId),
    ...{ sectionId, contentLength: content.length },
  });

  try {
    const previous = getState(fighterId, correlationId).outputs[sectionId];
    const model = previous?.model ?? "manual-edit";
    const mimeType = previous?.mimeType;
    setOutput(fighterId, sectionId, content, model, mimeType, correlationId);
    resetDownstream(fighterId, sectionId, correlationId);

    const output = getState(fighterId, correlationId).outputs[sectionId];
    if (!output) {
      throw new Error("Missing edited output.");
    }

    sendToFighter(fighterId, { type: "section:complete", sectionId, output });

    if (sectionId === "specsheet-prompt") {
      try {
        await runSpecsheetImageStep(fighterId, output.content, correlationId);
      } catch (imageError) {
        logger.error("pipeline auto image generation failed after edit", {
          ...withContext(fighterId, correlationId),
          ...{
            sectionId: "specsheet-image",
            durationMs: Date.now() - startedAt,
            error: getErrorMessage(imageError),
          },
        });
        emitSectionError(fighterId, "specsheet-image", imageError, correlationId);
      }
    }

    logger.info("pipeline edit completed", {
      ...withContext(fighterId, correlationId),
      ...{ sectionId, durationMs: Date.now() - startedAt, model, mimeType },
    });
  } catch (error) {
    logger.error("pipeline edit failed", {
      ...withContext(fighterId, correlationId),
      ...{ sectionId, durationMs: Date.now() - startedAt, error: getErrorMessage(error) },
    });
    throw error;
  }
};
