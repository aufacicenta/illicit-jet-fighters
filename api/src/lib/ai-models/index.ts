export const aiModels = {
  characterDescription: "anthropic/claude-sonnet-4",
  specsheetPrompt: "anthropic/claude-sonnet-4",
  specsheetImage: "google/gemini-3.1-flash-image-preview",
} as const;

export type AiModelKey = keyof typeof aiModels;
