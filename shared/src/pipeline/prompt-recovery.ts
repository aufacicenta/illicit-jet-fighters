export const RECOVERED_PROMPT_MARKER = "__storage_recovered__";

export const assetBackedPromptImagePairs = [
  ["character-pfp-prompt", "character-pfp-image"],
  ["specsheet-prompt", "specsheet-image"],
  ["spritesheet-prompt", "spritesheet-image"],
  ["strikecraft-specsheet-prompt", "strikecraft-specsheet-image"],
  ["strikecraft-sprite-prompt", "strikecraft-sprite-image"],
] as const;

type PromptRecoverableOutput = {
  sectionId: string;
  content: string;
  generatedAt: string;
  model: string;
  mimeType?: string;
  assetUrl?: string;
};

export const hasPersistedPromptContent = (content: string | undefined): content is string => {
  const trimmed = content?.trim();
  return Boolean(trimmed) && trimmed !== RECOVERED_PROMPT_MARKER;
};

export const inferMissingPromptOutputsFromAssets = <T extends PromptRecoverableOutput>(
  outputs: Partial<Record<string, T>>,
): Partial<Record<string, T>> => {
  const next = { ...outputs };

  for (const [promptId, imageId] of assetBackedPromptImagePairs) {
    if (next[imageId] && !hasPersistedPromptContent(next[promptId]?.content)) {
      next[promptId] = {
        sectionId: promptId,
        content: RECOVERED_PROMPT_MARKER,
        generatedAt: next[imageId]!.generatedAt,
        model: "storage-recovered",
      } as T;
    }
  }

  return next;
};

export const didInferMissingPromptOutputs = (
  before: Partial<Record<string, PromptRecoverableOutput>>,
  after: Partial<Record<string, PromptRecoverableOutput>>,
): boolean =>
  assetBackedPromptImagePairs.some(([promptId]) => Boolean(after[promptId]) && !before[promptId]);
