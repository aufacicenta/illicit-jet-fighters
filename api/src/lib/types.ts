export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type SectionId = "character-description" | "specsheet-prompt" | "specsheet-image";

export type SectionOutput = {
  sectionId: SectionId;
  content: string;
  generatedAt: string;
  model: string;
  mimeType?: string;
};
