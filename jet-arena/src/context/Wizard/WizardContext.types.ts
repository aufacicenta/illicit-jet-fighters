import type { ReactNode } from "react";

import type { ChatMessage } from "../../lib/api";

export type WizardContextControllerProps = {
  fighterId: string;
  children: ReactNode;
};

export type SectionId = "character-description" | "specsheet-prompt" | "specsheet-image";

export type SectionStatus = "locked" | "ready" | "generating" | "complete" | "error";

export type SectionOutput = {
  sectionId: SectionId;
  content: string;
  generatedAt: string;
  model: string;
  mimeType?: string;
};

export type ServerMessage =
  | { type: "section:start"; sectionId: SectionId }
  | { type: "section:complete"; sectionId: SectionId; output: SectionOutput }
  | { type: "section:error"; sectionId: SectionId; error: string }
  | { type: "pipeline:complete" }
  | { type: "pipeline:gate"; sectionId: SectionId; message: string };

export type WizardContextType = {
  fighterId: string;
  activeSectionId: SectionId | null;
  sectionStatuses: Record<SectionId, SectionStatus>;
  outputs: Partial<Record<SectionId, SectionOutput>>;
  sectionHistories: Partial<Record<SectionId, ChatMessage[]>>;
  gateMessage: string | null;
  promptInput: string;
  errorMessage: string | null;
  setPromptInput: (value: string) => void;
  setActiveSection: (sectionId: SectionId) => void;
  submitPrompt: () => Promise<void>;
  requestContinuePipeline: () => void;
  saveEditedSection: (sectionId: SectionId, content: string) => void;
};
