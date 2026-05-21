import type { ReactNode } from "react";

import type { ChatMessage } from "../../lib/api";

export type WizardContextControllerProps = {
  fighterId: string;
  children: ReactNode;
};

export type SectionId =
  | "character-description"
  | "specsheet-prompt"
  | "specsheet-image"
  | "spritesheet-prompt"
  | "spritesheet-image"
  | "agent-code"
  | "strikecraft-specsheet-prompt"
  | "strikecraft-specsheet-image"
  | "strikecraft-sprite-prompt"
  | "strikecraft-sprite-image";

export type SectionStatus = "locked" | "ready" | "generating" | "complete" | "error";

export type SectionOutput = {
  sectionId: SectionId;
  content: string;
  generatedAt: string;
  model: string;
  mimeType?: string;
  assetUrl?: string;
};

export type ServerMessage =
  | { type: "section:start"; sectionId: SectionId }
  | { type: "section:delta"; sectionId: SectionId; delta: string }
  | { type: "section:complete"; sectionId: SectionId; output: SectionOutput }
  | { type: "section:error"; sectionId: SectionId; error: string }
  | { type: "pipeline:complete" }
  | { type: "pipeline:gate"; sectionId: SectionId; message: string }
  | {
      type: "pipeline:sync";
      sectionStatuses: Record<SectionId, SectionStatus>;
      outputs: Partial<Record<SectionId, SectionOutput>>;
      histories: Partial<Record<SectionId, ChatMessage[]>>;
      gateMessage: string | null;
    };

export type WebSocketConnectionStatus = "connecting" | "open" | "closed";

export type WizardContextType = {
  fighterId: string;
  originalBriefing: string | null;
  activeSectionId: SectionId | null;
  sectionStatuses: Record<SectionId, SectionStatus>;
  outputs: Partial<Record<SectionId, SectionOutput>>;
  sectionHistories: Partial<Record<SectionId, ChatMessage[]>>;
  gateMessage: string | null;
  promptInput: string;
  errorMessage: string | null;
  connectionStatus: WebSocketConnectionStatus;
  setPromptInput: (value: string) => void;
  setActiveSection: (sectionId: SectionId) => void;
  submitPrompt: () => Promise<void>;
  requestContinuePipeline: () => void;
  requestRegenerateAgentCode: () => Promise<void>;
  requestRegenerateSpritesheetImage: () => Promise<void>;
  requestRegenerateStrikecraftSpriteImage: () => Promise<void>;
  saveEditedSection: (sectionId: SectionId, content: string) => void;
};
