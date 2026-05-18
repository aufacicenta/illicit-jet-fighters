export const aiModels = {
  characterDescription: "anthropic/claude-sonnet-4",
  specsheetPrompt: "anthropic/claude-sonnet-4",
  specsheetImage: "google/gemini-3.1-flash-image-preview",
  spritesheetPrompt: "anthropic/claude-sonnet-4",
  spritesheetImage: "google/gemini-3.1-flash-image-preview",
  agentCode: "anthropic/claude-sonnet-4",
  strikecraftSpecsheetPrompt: "anthropic/claude-sonnet-4",
  strikecraftSpecsheetImage: "google/gemini-3.1-flash-image-preview",
  strikecraftSpritePrompt: "anthropic/claude-sonnet-4",
  strikecraftSpriteImage: "google/gemini-3.1-flash-image-preview",
} as const;

export type AiModelKey = keyof typeof aiModels;
