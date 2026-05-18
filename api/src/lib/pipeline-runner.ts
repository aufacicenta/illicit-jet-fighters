import { clearPendingForFighter, sendToFighter } from "../ws/store";
import { touchFighterUpdatedAt } from "./fighter-access";
import {
  generateCharacterDescription,
  generateCharacterDescriptionRefine,
  generateSpecsheetImage,
  generateSpecsheetPrompt,
  generateSpecsheetPromptRefine,
} from "./generate";
import { decodeImagePayload, extensionForMime } from "./image-payload";
import { withFighterContext as withContext } from "./log-context";
import { logger } from "./logger";
import type { SectionStatus } from "./pipeline-status";
import { deriveSectionStatuses } from "./pipeline-status";
import {
  getObjectBuffer,
  getSignedReadUrl,
  pipelineStateObjectKey,
  putObject,
  specsheetObjectKey,
} from "./r2";
import type { ChatMessage, SectionId, SectionOutput } from "./types";

export type PipelineTenant = {
  userId: string;
  fighterId: number;
};

type FighterPipelineState = {
  outputs: Partial<Record<SectionId, SectionOutput>>;
  histories: Partial<Record<SectionId, ChatMessage[]>>;
  activeSectionId: SectionId | null;
  lastErrorSectionId: SectionId | null;
  gateMessage: string | null;
};

type PersistedPipelineSnapshot = {
  version: 1;
  outputs: Partial<Record<SectionId, SectionOutput>>;
  histories: Partial<Record<SectionId, ChatMessage[]>>;
  activeSectionId: SectionId | null;
  lastErrorSectionId: SectionId | null;
  gateMessage: string | null;
};

const PIPELINE_STORAGE_VERSION = 1 as const;
const stepOrder: SectionId[] = ["character-description", "specsheet-prompt", "specsheet-image"];

const stateByFighter = new Map<string, FighterPipelineState>();
const tenantByFighter = new Map<string, PipelineTenant>();

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const bindPipelineTenant = (fighterKey: string, tenant: PipelineTenant) => {
  tenantByFighter.set(fighterKey, tenant);
};

const requireTenant = (fighterKey: string): PipelineTenant => {
  const tenant = tenantByFighter.get(fighterKey);
  if (!tenant) {
    throw new Error("Pipeline session is missing authenticated fighter context.");
  }
  return tenant;
};

const stripOutputsForPersist = (
  outputs: Partial<Record<SectionId, SectionOutput>>,
): Partial<Record<SectionId, SectionOutput>> => {
  const next: Partial<Record<SectionId, SectionOutput>> = {};
  for (const sectionId of stepOrder) {
    const entry = outputs[sectionId];
    if (!entry) {
      continue;
    }
    const { assetUrl: _discard, ...rest } = entry;
    next[sectionId] = rest as SectionOutput;
  }
  return next;
};

const persistSnapshot = async (
  fighterKey: string,
  state: FighterPipelineState,
  tenant: PipelineTenant,
) => {
  try {
    const snapshot: PersistedPipelineSnapshot = {
      version: PIPELINE_STORAGE_VERSION,
      outputs: stripOutputsForPersist(state.outputs),
      histories: state.histories,
      activeSectionId: state.activeSectionId,
      lastErrorSectionId: state.lastErrorSectionId,
      gateMessage: state.gateMessage,
    };
    await putObject(
      pipelineStateObjectKey(tenant.userId, tenant.fighterId),
      Buffer.from(JSON.stringify(snapshot)),
      "application/json",
    );
    await touchFighterUpdatedAt(tenant.fighterId);
  } catch (error) {
    logger.warn("pipeline snapshot persist failed", {
      ...withContext(fighterKey),
      error: getErrorMessage(error),
    });
  }
};

const getState = (fighterKey: string, correlationId?: string): FighterPipelineState => {
  const current = stateByFighter.get(fighterKey);
  if (current) {
    logger.debug("pipeline state loaded", withContext(fighterKey, correlationId));
    return current;
  }

  const created: FighterPipelineState = {
    outputs: {},
    histories: {},
    activeSectionId: null,
    lastErrorSectionId: null,
    gateMessage: null,
  };
  stateByFighter.set(fighterKey, created);
  logger.info("pipeline state created", withContext(fighterKey, correlationId));
  return created;
};

export const hydratePipelineFromBucket = async (
  fighterKey: string,
  tenant: PipelineTenant,
): Promise<boolean> => {
  const existing = stateByFighter.get(fighterKey);
  if (existing) {
    return true;
  }

  bindPipelineTenant(fighterKey, tenant);

  try {
    const raw = await getObjectBuffer(pipelineStateObjectKey(tenant.userId, tenant.fighterId));
    if (!raw) {
      return false;
    }

    const snapshot = JSON.parse(raw.toString()) as PersistedPipelineSnapshot;
    if (snapshot.version !== PIPELINE_STORAGE_VERSION || !snapshot.outputs) {
      return false;
    }

    const state = getState(fighterKey);
    state.outputs = snapshot.outputs ?? {};
    state.histories = snapshot.histories ?? {};
    state.activeSectionId = snapshot.activeSectionId ?? null;
    state.lastErrorSectionId = snapshot.lastErrorSectionId ?? null;
    state.gateMessage = snapshot.gateMessage ?? null;
    logger.info("pipeline hydrated from object storage", withContext(fighterKey));
    return true;
  } catch (error) {
    logger.warn("pipeline hydrate failed", {
      ...withContext(fighterKey),
      error: getErrorMessage(error),
    });
    return false;
  }
};

const sanitizeSectionOutput = async (
  sectionId: SectionId,
  output: SectionOutput,
): Promise<SectionOutput> => {
  if (sectionId !== "specsheet-image") {
    const { assetUrl: _discard, ...rest } = output;
    return rest;
  }

  if (output.content.startsWith("http://") || output.content.startsWith("https://")) {
    const { assetUrl: _discard, ...rest } = output;
    return { ...rest, assetUrl: output.content };
  }

  try {
    const signed = await getSignedReadUrl(output.content);
    const { assetUrl: _discard, ...rest } = output;
    return { ...rest, content: signed, assetUrl: signed };
  } catch {
    return output;
  }
};

const sanitizeOutputs = async (
  outputs: Partial<Record<SectionId, SectionOutput>>,
): Promise<Partial<Record<SectionId, SectionOutput>>> => {
  const next: Partial<Record<SectionId, SectionOutput>> = {};
  for (const sectionId of stepOrder) {
    const output = outputs[sectionId];
    if (!output) {
      continue;
    }
    next[sectionId] = await sanitizeSectionOutput(sectionId, output);
  }

  return next;
};

export type ClientPipelineStateSnapshot = {
  sectionStatuses: Record<SectionId, SectionStatus>;
  outputs: Partial<Record<SectionId, SectionOutput>>;
  histories: Partial<Record<SectionId, ChatMessage[]>>;
  gateMessage: string | null;
};

type FighterPipelinePreview = {
  characterDescription: string | null;
  specsheetPrompt: string | null;
  specsheetImageUrl: string | null;
  status: SectionStatus;
};

export const buildFighterPreviewFromSnapshot = (
  snapshot: ClientPipelineStateSnapshot,
): FighterPipelinePreview => {
  const characterDescription = snapshot.outputs["character-description"]?.content ?? null;
  const specsheetPrompt = snapshot.outputs["specsheet-prompt"]?.content ?? null;
  const specsheetImageUrl =
    snapshot.outputs["specsheet-image"]?.assetUrl ??
    snapshot.outputs["specsheet-image"]?.content ??
    null;

  const statuses = Object.values(snapshot.sectionStatuses);
  let status: SectionStatus = "ready";
  if (statuses.includes("error")) {
    status = "error";
  } else if (statuses.includes("generating")) {
    status = "generating";
  } else if (snapshot.sectionStatuses["specsheet-image"] === "complete") {
    status = "complete";
  } else if (statuses.includes("complete")) {
    status = "ready";
  } else if (statuses.includes("locked")) {
    status = "locked";
  }

  return {
    characterDescription,
    specsheetPrompt,
    specsheetImageUrl,
    status,
  };
};

export const serializeClientPipelineState = async (
  fighterKey: string,
): Promise<ClientPipelineStateSnapshot | null> => {
  const tenant = tenantByFighter.get(fighterKey);
  if (!tenant) {
    return null;
  }

  let state = stateByFighter.get(fighterKey);

  if (!state) {
    await hydratePipelineFromBucket(fighterKey, tenant);
    state = stateByFighter.get(fighterKey);
  }

  if (!state) {
    return {
      sectionStatuses: deriveSectionStatuses({
        outputs: {},
        activeSectionId: null,
        lastErrorSectionId: null,
      }),
      outputs: {},
      histories: {},
      gateMessage: null,
    };
  }

  return {
    sectionStatuses: deriveSectionStatuses({
      outputs: state.outputs,
      activeSectionId: state.activeSectionId,
      lastErrorSectionId: state.lastErrorSectionId,
    }),
    outputs: await sanitizeOutputs(state.outputs),
    histories: state.histories,
    gateMessage: state.gateMessage,
  };
};

const nowIso = () => new Date().toISOString();

const setOutput = (
  fighterKey: string,
  sectionId: SectionId,
  content: string,
  model: string,
  mimeType?: string,
  correlationId?: string,
  assetUrl?: string,
): SectionOutput => {
  const output: SectionOutput = {
    sectionId,
    content,
    generatedAt: nowIso(),
    model,
    mimeType,
    ...(assetUrl ? { assetUrl } : {}),
  };

  const state = getState(fighterKey, correlationId);
  state.outputs[sectionId] = output;
  logger.debug("pipeline output stored", {
    ...withContext(fighterKey, correlationId),
    sectionId,
    model,
    mimeType,
    contentLength: content.length,
  });
  return output;
};

const setHistory = (
  fighterKey: string,
  sectionId: SectionId,
  history: ChatMessage[],
  correlationId?: string,
) => {
  const state = getState(fighterKey, correlationId);
  state.histories[sectionId] = history;
  logger.debug("pipeline history stored", {
    ...withContext(fighterKey, correlationId),
    sectionId,
    historyLength: history.length,
  });
};

const resetDownstream = (fighterKey: string, sectionId: SectionId, correlationId?: string) => {
  const state = getState(fighterKey, correlationId);
  const startIdx = stepOrder.indexOf(sectionId);
  const downstream = stepOrder.slice(startIdx + 1);

  for (const step of downstream) {
    delete state.outputs[step];
    delete state.histories[step];
  }

  logger.info("pipeline downstream reset", {
    ...withContext(fighterKey, correlationId),
    sectionId,
    clearedSections: downstream,
  });
};

const buildSyncMessage = async (state: FighterPipelineState) => ({
  type: "pipeline:sync" as const,
  sectionStatuses: deriveSectionStatuses({
    outputs: state.outputs,
    activeSectionId: state.activeSectionId,
    lastErrorSectionId: state.lastErrorSectionId,
  }),
  outputs: await sanitizeOutputs(state.outputs),
  histories: state.histories,
  gateMessage: state.gateMessage,
});

export const syncPipelineState = async (fighterKey: string) => {
  const state = stateByFighter.get(fighterKey);
  if (!state) {
    return;
  }

  try {
    const tenant = tenantByFighter.get(fighterKey);
    if (tenant) {
      await persistSnapshot(fighterKey, state, tenant);
    }

    sendToFighter(fighterKey, await buildSyncMessage(state));
  } catch (error) {
    logger.error("pipeline sync broadcast failed", {
      ...withContext(fighterKey),
      error: getErrorMessage(error),
    });
  }
};

export const sanitizeSingleOutputForClient = (sectionId: SectionId, output: SectionOutput) =>
  sanitizeSectionOutput(sectionId, output);

const emitSectionError = (
  fighterKey: string,
  sectionId: SectionId,
  error: unknown,
  correlationId?: string,
) => {
  const state = getState(fighterKey, correlationId);
  const errorMessage = error instanceof Error ? error.message : "Unknown pipeline error.";
  state.activeSectionId = null;
  state.lastErrorSectionId = sectionId;
  sendToFighter(fighterKey, {
    type: "section:error",
    sectionId,
    error: errorMessage,
  });
};

const commitSpecsheetImage = async ({
  fighterKey,
  mimeTypeHint,
  imageUrl,
}: {
  fighterKey: string;
  mimeTypeHint: string;
  imageUrl: string;
}): Promise<{ objectKey: string; signedUrl: string }> => {
  const tenant = requireTenant(fighterKey);
  const { buffer, mimeType } = await decodeImagePayload(imageUrl, mimeTypeHint);
  const resolvedMime = mimeType || mimeTypeHint || "image/png";
  const extension = extensionForMime(resolvedMime);
  const objectKey = specsheetObjectKey(tenant.userId, tenant.fighterId, extension);
  await putObject(objectKey, buffer, resolvedMime);
  const signedUrl = await getSignedReadUrl(objectKey);
  return { objectKey, signedUrl };
};

const broadcastSectionComplete = async (
  fighterKey: string,
  sectionId: SectionId,
  output: SectionOutput,
) => {
  sendToFighter(fighterKey, {
    type: "section:complete",
    sectionId,
    output: await sanitizeSectionOutput(sectionId, output),
  });
};

const runSpecsheetImageStep = async (
  fighterKey: string,
  prompt: string,
  correlationId?: string,
  startedAt?: number,
) => {
  const tenant = tenantByFighter.get(fighterKey);
  const state = getState(fighterKey, correlationId);
  const imageStartedAt = Date.now();
  state.activeSectionId = "specsheet-image";
  sendToFighter(fighterKey, { type: "section:start", sectionId: "specsheet-image" });

  const image = await generateSpecsheetImage(prompt);

  try {
    const { objectKey, signedUrl } = await commitSpecsheetImage({
      fighterKey,
      imageUrl: image.imageBase64,
      mimeTypeHint: image.mimeType,
    });
    const output = setOutput(
      fighterKey,
      "specsheet-image",
      objectKey,
      image.model,
      image.mimeType,
      correlationId,
      signedUrl,
    );
    sendToFighter(fighterKey, {
      type: "section:complete",
      sectionId: "specsheet-image",
      output: await sanitizeSectionOutput("specsheet-image", output),
    });
    logger.info("pipeline section completed", {
      ...withContext(fighterKey, correlationId),
      sectionId: "specsheet-image",
      durationMs: Date.now() - imageStartedAt,
      model: image.model,
      mimeType: image.mimeType,
    });

    if (tenant) {
      await persistSnapshot(fighterKey, state, tenant);
    }

    state.activeSectionId = null;
    state.gateMessage =
      "Character description and specsheet are ready. Continue generating remaining assets?";
    sendToFighter(fighterKey, {
      type: "pipeline:gate",
      sectionId: "specsheet-image",
      message: state.gateMessage,
    });
    logger.info("pipeline gate emitted", {
      ...withContext(fighterKey, correlationId),
      sectionId: "specsheet-image",
      totalDurationMs: startedAt ? Date.now() - startedAt : Date.now() - imageStartedAt,
    });
  } catch (error) {
    emitSectionError(fighterKey, "specsheet-image", error, correlationId);
    return;
  }
};

export const startPipeline = async (fighterKey: string, prompt: string, correlationId?: string) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  logger.info("pipeline start requested", {
    ...withContext(fighterKey, correlationId),
    promptLength: prompt.length,
  });

  clearPendingForFighter(fighterKey);

  const state = getState(fighterKey, correlationId);
  state.outputs = {};
  state.histories = {};
  state.activeSectionId = null;
  state.lastErrorSectionId = null;
  state.gateMessage = null;
  logger.debug("pipeline state cleared", withContext(fighterKey, correlationId));

  const tenant = tenantByFighter.get(fighterKey);

  try {
    const characterStartedAt = Date.now();
    state.activeSectionId = "character-description";
    sendToFighter(fighterKey, {
      type: "section:start",
      sectionId: "character-description",
    });

    const character = await generateCharacterDescription(prompt);
    const characterOutput = setOutput(
      fighterKey,
      "character-description",
      character.markdown,
      character.model,
      undefined,
      correlationId,
    );
    await broadcastSectionComplete(fighterKey, "character-description", characterOutput);
    setHistory(
      fighterKey,
      "character-description",
      [
        { role: "user", content: prompt },
        { role: "assistant", content: character.markdown },
      ],
      correlationId,
    );

    logger.info("pipeline section completed", {
      ...withContext(fighterKey, correlationId),
      sectionId: "character-description",
      durationMs: Date.now() - characterStartedAt,
      model: character.model,
    });

    state.activeSectionId = null;

    if (tenant) {
      await persistSnapshot(fighterKey, state, tenant);
    }

    const promptStartedAt = Date.now();
    state.activeSectionId = "specsheet-prompt";
    sendToFighter(fighterKey, { type: "section:start", sectionId: "specsheet-prompt" });
    const specPrompt = await generateSpecsheetPrompt(character.markdown);
    const specOutput = setOutput(
      fighterKey,
      "specsheet-prompt",
      specPrompt.prompt,
      specPrompt.model,
      undefined,
      correlationId,
    );

    await broadcastSectionComplete(fighterKey, "specsheet-prompt", specOutput);

    setHistory(
      fighterKey,
      "specsheet-prompt",
      [
        { role: "user", content: character.markdown },
        { role: "assistant", content: specPrompt.prompt },
      ],
      correlationId,
    );

    logger.info("pipeline section completed", {
      ...withContext(fighterKey, correlationId),
      sectionId: "specsheet-prompt",
      durationMs: Date.now() - promptStartedAt,
      model: specPrompt.model,
    });

    state.activeSectionId = null;

    if (tenant) {
      await persistSnapshot(fighterKey, state, tenant);
    }

    await runSpecsheetImageStep(fighterKey, specPrompt.prompt, correlationId, startedAt);
    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  } catch (error) {
    logger.error("pipeline start failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    emitSectionError(
      fighterKey,
      getState(fighterKey, correlationId).activeSectionId ?? "character-description",
      error,
      correlationId,
    );
  }
};

export const generateSpecsheetFromCharacterDescription = async (
  fighterKey: string,
  characterDescription: string,
  correlationId?: string,
) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  logger.info("pipeline specsheet generation requested", {
    ...withContext(fighterKey, correlationId),
    descriptionLength: characterDescription.length,
  });

  const state = getState(fighterKey, correlationId);
  state.gateMessage = null;
  state.lastErrorSectionId = null;
  const tenant = tenantByFighter.get(fighterKey);

  try {
    const promptStartedAt = Date.now();
    state.activeSectionId = "specsheet-prompt";
    sendToFighter(fighterKey, { type: "section:start", sectionId: "specsheet-prompt" });

    const specPrompt = await generateSpecsheetPrompt(characterDescription);

    const specOutput = setOutput(
      fighterKey,
      "specsheet-prompt",
      specPrompt.prompt,
      specPrompt.model,
      undefined,
      correlationId,
    );
    await broadcastSectionComplete(fighterKey, "specsheet-prompt", specOutput);

    setHistory(
      fighterKey,
      "specsheet-prompt",
      [
        { role: "user", content: characterDescription },
        { role: "assistant", content: specPrompt.prompt },
      ],
      correlationId,
    );
    logger.info("pipeline section completed", {
      ...withContext(fighterKey, correlationId),
      sectionId: "specsheet-prompt",
      durationMs: Date.now() - promptStartedAt,
      model: specPrompt.model,
    });

    if (tenant) {
      await persistSnapshot(fighterKey, state, tenant);
    }

    await runSpecsheetImageStep(fighterKey, specPrompt.prompt, correlationId, startedAt);
    if (tenant) {
      await syncPipelineState(fighterKey);
    }
  } catch (error) {
    logger.error("pipeline specsheet generation failed", {
      ...withContext(fighterKey, correlationId),
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    emitSectionError(
      fighterKey,
      getState(fighterKey, correlationId).activeSectionId ?? "specsheet-prompt",
      error,
      correlationId,
    );
  }
};

export const continuePipeline = async (fighterKey: string, correlationId?: string) => {
  logger.info("pipeline continue requested", withContext(fighterKey, correlationId));
  const state = getState(fighterKey, correlationId);
  state.gateMessage = null;
  sendToFighter(fighterKey, { type: "pipeline:complete" });
  const tenant = tenantByFighter.get(fighterKey);
  if (tenant) {
    await persistSnapshot(fighterKey, state, tenant);
  }
  logger.info("pipeline marked complete", withContext(fighterKey, correlationId));
};

export const refineSection = async (
  fighterKey: string,
  sectionId: SectionId,
  message: string,
  history: ChatMessage[],
  correlationId?: string,
) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  logger.info("pipeline refine requested", {
    ...withContext(fighterKey, correlationId),
    sectionId,
    messageLength: message.length,
    historyLength: history.length,
  });

  const state = getState(fighterKey, correlationId);
  const tenant = tenantByFighter.get(fighterKey);
  state.activeSectionId = sectionId;
  state.lastErrorSectionId = null;
  sendToFighter(fighterKey, { type: "section:start", sectionId });

  try {
    if (sectionId === "character-description") {
      const refined = await generateCharacterDescriptionRefine(history, message);
      const outputRecord = setOutput(
        fighterKey,
        sectionId,
        refined.markdown,
        refined.model,
        undefined,
        correlationId,
      );
      setHistory(
        fighterKey,
        sectionId,
        [
          ...history,
          { role: "user", content: message },
          { role: "assistant", content: refined.markdown },
        ],
        correlationId,
      );
      resetDownstream(fighterKey, sectionId, correlationId);
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);

      logger.info("pipeline refine generated", {
        ...withContext(fighterKey, correlationId),
        sectionId,
        model: refined.model,
      });
    } else if (sectionId === "specsheet-prompt") {
      const refined = await generateSpecsheetPromptRefine(history, message);
      const outputRecord = setOutput(
        fighterKey,
        sectionId,
        refined.prompt,
        refined.model,
        undefined,
        correlationId,
      );

      setHistory(
        fighterKey,
        sectionId,
        [
          ...history,
          { role: "user", content: message },
          { role: "assistant", content: refined.prompt },
        ],
        correlationId,
      );
      resetDownstream(fighterKey, sectionId, correlationId);
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);

      logger.info("pipeline refine generated", {
        ...withContext(fighterKey, correlationId),
        sectionId,
        model: refined.model,
      });
    } else {
      const generated = await generateSpecsheetImage(message);
      const committed = await commitSpecsheetImage({
        fighterKey,
        imageUrl: generated.imageBase64,
        mimeTypeHint: generated.mimeType,
      });

      const outputRecord = setOutput(
        fighterKey,
        sectionId,
        committed.objectKey,
        generated.model,
        generated.mimeType,
        correlationId,
        committed.signedUrl,
      );
      resetDownstream(fighterKey, sectionId, correlationId);
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);
      logger.info("pipeline refine generated", {
        ...withContext(fighterKey, correlationId),
        sectionId,
        model: generated.model,
        mimeType: generated.mimeType,
      });
    }

    if (tenant) {
      await persistSnapshot(fighterKey, getState(fighterKey, correlationId), tenant);
      await syncPipelineState(fighterKey);
    }

    if (sectionId === "specsheet-prompt") {
      try {
        const output = getState(fighterKey, correlationId).outputs["specsheet-prompt"];
        if (!output) {
          throw new Error("Missing specsheet prompt.");
        }

        await runSpecsheetImageStep(fighterKey, output.content, correlationId);
      } catch (imageError) {
        logger.error("pipeline auto image generation failed after refine", {
          ...withContext(fighterKey, correlationId),
          sectionId: "specsheet-image",
          durationMs: Date.now() - startedAt,
          error: getErrorMessage(imageError),
        });
        emitSectionError(fighterKey, "specsheet-image", imageError, correlationId);
      }
    }

    logger.info("pipeline refine completed", {
      ...withContext(fighterKey, correlationId),
      sectionId,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error("pipeline refine failed", {
      ...withContext(fighterKey, correlationId),
      sectionId,
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    emitSectionError(fighterKey, sectionId, error, correlationId);
  }
};

export const editSection = async (
  fighterKey: string,
  sectionId: SectionId,
  content: string,
  correlationId?: string,
) => {
  requireTenant(fighterKey);

  const startedAt = Date.now();
  logger.info("pipeline edit requested", {
    ...withContext(fighterKey, correlationId),
    sectionId,
    contentLength: content.length,
  });

  const tenant = tenantByFighter.get(fighterKey);

  try {
    const previous = getState(fighterKey, correlationId).outputs[sectionId];
    const model = previous?.model ?? "manual-edit";
    const mimeType = previous?.mimeType;

    if (sectionId === "specsheet-image") {
      const committed = await commitSpecsheetImage({
        fighterKey,
        imageUrl: content,
        mimeTypeHint: mimeType ?? "image/png",
      });
      const outputRecord = setOutput(
        fighterKey,
        sectionId,
        committed.objectKey,
        model,
        mimeType ?? "image/png",
        correlationId,
        committed.signedUrl,
      );
      resetDownstream(fighterKey, sectionId, correlationId);
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);
    } else {
      const outputRecord = setOutput(
        fighterKey,
        sectionId,
        content,
        model,
        mimeType,
        correlationId,
      );
      resetDownstream(fighterKey, sectionId, correlationId);
      await broadcastSectionComplete(fighterKey, sectionId, outputRecord);
    }

    if (tenant) {
      await persistSnapshot(fighterKey, getState(fighterKey, correlationId), tenant);
      await syncPipelineState(fighterKey);
    }

    if (sectionId === "specsheet-prompt") {
      try {
        const output = getState(fighterKey, correlationId).outputs["specsheet-prompt"];
        if (!output) {
          throw new Error("Missing edited specsheet prompt.");
        }

        await runSpecsheetImageStep(fighterKey, output.content, correlationId);
      } catch (imageError) {
        logger.error("pipeline auto image generation failed after edit", {
          ...withContext(fighterKey, correlationId),
          sectionId: "specsheet-image",
          durationMs: Date.now() - startedAt,
          error: getErrorMessage(imageError),
        });
        emitSectionError(fighterKey, "specsheet-image", imageError, correlationId);
      }
    }

    logger.info("pipeline edit completed", {
      ...withContext(fighterKey, correlationId),
      sectionId,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error("pipeline edit failed", {
      ...withContext(fighterKey, correlationId),
      sectionId,
      durationMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    });
    throw error;
  }
};
