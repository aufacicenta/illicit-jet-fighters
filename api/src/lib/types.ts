export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type SectionId =
  | "character-description"
  | "character-pfp-prompt"
  | "character-pfp-image"
  | "specsheet-prompt"
  | "specsheet-image"
  | "spritesheet-prompt"
  | "spritesheet-image"
  | "spritesheet-manifest"
  | "agent-code"
  | "strikecraft-specsheet-prompt"
  | "strikecraft-specsheet-image"
  | "strikecraft-sprite-prompt"
  | "strikecraft-sprite-image"
  | "battlefield-description"
  | "battlefield-sheet-prompt"
  | "battlefield-sheet-image"
  | "battlefield-config";

export type SectionOutput = {
  sectionId: SectionId;
  content: string;
  generatedAt: string;
  model: string;
  mimeType?: string;
  assetUrl?: string;
};

export type FighterSectionId = Exclude<
  SectionId,
  | "battlefield-description"
  | "battlefield-sheet-prompt"
  | "battlefield-sheet-image"
  | "battlefield-config"
>;

export type BattlefieldSectionId = Extract<
  SectionId,
  | "battlefield-description"
  | "battlefield-sheet-prompt"
  | "battlefield-sheet-image"
  | "battlefield-config"
>;
