export const aiModels = {
  characterDescription: "anthropic/claude-sonnet-4",
  specsheetPrompt: "anthropic/claude-sonnet-4",
  specsheetImage: "google/gemini-2.5-flash-preview:image",
} as const;

export type AiModelKey = keyof typeof aiModels;
