export const aiModels = {
  characterDescription: "anthropic/claude-sonnet-4",
  specsheetPrompt: "anthropic/claude-sonnet-4",
  specsheetImage: "google/gemini-3.1-flash-image-preview",
  spritesheetPrompt: "anthropic/claude-sonnet-4",
  spritesheetImage: "openai/gpt-5-image-mini",
  agentCode: "anthropic/claude-sonnet-4",
  strikecraftSpecsheetPrompt: "anthropic/claude-sonnet-4",
  strikecraftSpecsheetImage: "google/gemini-3.1-flash-image-preview",
  strikecraftSpritePrompt: "anthropic/claude-sonnet-4",
  strikecraftSpriteImage: "openai/gpt-5-image-mini",
} as const;

export type AiModelKey = keyof typeof aiModels;
