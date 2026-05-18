import { sendToFighter } from "../ws/store";
import {
  generateCharacterDescription,
  generateCharacterDescriptionRefine,
  generateSpecsheetImage,
  generateSpecsheetPrompt,
  generateSpecsheetPromptRefine,
} from "./generate";
import type { ChatMessage, SectionId, SectionOutput } from "./types";

type FighterPipelineState = {
  outputs: Partial<Record<SectionId, SectionOutput>>;
  histories: Partial<Record<SectionId, ChatMessage[]>>;
};

const stepOrder: SectionId[] = ["character-description", "specsheet-prompt", "specsheet-image"];

const stateByFighter = new Map<string, FighterPipelineState>();

const getState = (fighterId: string): FighterPipelineState => {
  const current = stateByFighter.get(fighterId);
  if (current) {
    return current;
  }

  const created: FighterPipelineState = {
    outputs: {},
    histories: {},
  };
  stateByFighter.set(fighterId, created);
  return created;
};

const nowIso = () => new Date().toISOString();

const setOutput = (
  fighterId: string,
  sectionId: SectionId,
  content: string,
  model: string,
  mimeType?: string,
) => {
  const state = getState(fighterId);
  state.outputs[sectionId] = {
    sectionId,
    content,
    generatedAt: nowIso(),
    model,
    mimeType,
  };
};

const setHistory = (fighterId: string, sectionId: SectionId, history: ChatMessage[]) => {
  const state = getState(fighterId);
  state.histories[sectionId] = history;
};

const resetDownstream = (fighterId: string, sectionId: SectionId) => {
  const state = getState(fighterId);
  const startIdx = stepOrder.indexOf(sectionId);
  const downstream = stepOrder.slice(startIdx + 1);

  for (const step of downstream) {
    delete state.outputs[step];
    delete state.histories[step];
  }
};

export const startPipeline = async (fighterId: string, prompt: string) => {
  const state = getState(fighterId);
  state.outputs = {};
  state.histories = {};

  try {
    sendToFighter(fighterId, {
      type: "section:start",
      sectionId: "character-description",
    });

    const character = await generateCharacterDescription(prompt);
    setOutput(fighterId, "character-description", character.markdown, character.model);
    setHistory(fighterId, "character-description", [
      { role: "user", content: prompt },
      { role: "assistant", content: character.markdown },
    ]);
    sendToFighter(fighterId, {
      type: "section:complete",
      sectionId: "character-description",
      output: state.outputs["character-description"]!,
    });

    sendToFighter(fighterId, { type: "section:start", sectionId: "specsheet-prompt" });
    const specPrompt = await generateSpecsheetPrompt(character.markdown);
    setOutput(fighterId, "specsheet-prompt", specPrompt.prompt, specPrompt.model);
    setHistory(fighterId, "specsheet-prompt", [
      { role: "user", content: character.markdown },
      { role: "assistant", content: specPrompt.prompt },
    ]);
    sendToFighter(fighterId, {
      type: "section:complete",
      sectionId: "specsheet-prompt",
      output: state.outputs["specsheet-prompt"]!,
    });

    sendToFighter(fighterId, { type: "section:start", sectionId: "specsheet-image" });
    const image = await generateSpecsheetImage(specPrompt.prompt);
    setOutput(fighterId, "specsheet-image", image.imageBase64, image.model, image.mimeType);
    sendToFighter(fighterId, {
      type: "section:complete",
      sectionId: "specsheet-image",
      output: state.outputs["specsheet-image"]!,
    });

    sendToFighter(fighterId, {
      type: "pipeline:gate",
      sectionId: "specsheet-image",
      message:
        "Character description and specsheet are ready. Continue generating remaining assets?",
    });
  } catch (error) {
    sendToFighter(fighterId, {
      type: "section:error",
      sectionId: "character-description",
      error: error instanceof Error ? error.message : "Unknown pipeline error.",
    });
  }
};

export const continuePipeline = (fighterId: string) => {
  sendToFighter(fighterId, { type: "pipeline:complete" });
};

export const refineSection = async (
  fighterId: string,
  sectionId: SectionId,
  message: string,
  history: ChatMessage[],
) => {
  sendToFighter(fighterId, { type: "section:start", sectionId });

  if (sectionId === "character-description") {
    const refined = await generateCharacterDescriptionRefine(history, message);
    setOutput(fighterId, sectionId, refined.markdown, refined.model);
    setHistory(fighterId, sectionId, [
      ...history,
      { role: "user", content: message },
      { role: "assistant", content: refined.markdown },
    ]);
  } else if (sectionId === "specsheet-prompt") {
    const refined = await generateSpecsheetPromptRefine(history, message);
    setOutput(fighterId, sectionId, refined.prompt, refined.model);
    setHistory(fighterId, sectionId, [
      ...history,
      { role: "user", content: message },
      { role: "assistant", content: refined.prompt },
    ]);
  } else {
    const generated = await generateSpecsheetImage(message);
    setOutput(fighterId, sectionId, generated.imageBase64, generated.model, generated.mimeType);
  }

  resetDownstream(fighterId, sectionId);

  const output = getState(fighterId).outputs[sectionId];
  if (!output) {
    throw new Error("Missing refined output.");
  }

  sendToFighter(fighterId, { type: "section:complete", sectionId, output });
};

export const editSection = async (fighterId: string, sectionId: SectionId, content: string) => {
  const previous = getState(fighterId).outputs[sectionId];
  const model = previous?.model ?? "manual-edit";
  const mimeType = previous?.mimeType;
  setOutput(fighterId, sectionId, content, model, mimeType);
  resetDownstream(fighterId, sectionId);

  const output = getState(fighterId).outputs[sectionId];
  if (!output) {
    throw new Error("Missing edited output.");
  }

  sendToFighter(fighterId, { type: "section:complete", sectionId, output });
};
