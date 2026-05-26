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
  | "spritesheet-manifest"
  | "agent-code"
  | "strikecraft-specsheet-prompt"
  | "strikecraft-specsheet-image"
  | "strikecraft-sprite-prompt"
  | "strikecraft-sprite-image";

export type SectionStatus = "locked" | "ready" | "generating" | "complete" | "error" | "blocked";

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
  | {
      type: "section:error";
      sectionId: SectionId;
      error: string;
      code?: "INSUFFICIENT_BALANCE" | "BILLING_FAILED";
      requiredMist?: string;
      balanceMist?: string;
    }
  | { type: "pipeline:complete" }
  | { type: "pipeline:gate"; sectionId: SectionId; message: string }
  | {
      type: "pipeline:sync";
      sectionStatuses: Record<SectionId, SectionStatus>;
      outputs: Partial<Record<SectionId, SectionOutput>>;
      histories: Partial<Record<SectionId, ChatMessage[]>>;
      gateMessage: string | null;
      fighterLedger: {
        isReady: boolean;
        balanceMist: string;
      };
    }
  | {
      type: "pipeline:cost-update";
      fighterId: number;
      totalCostUsd: string;
      latestRunCorrelationId: string | null;
      latestRunSectionCosts: Partial<Record<SectionId, string>>;
    }
  | {
      type: "wallet:insufficient-balance";
      sectionId: SectionId;
      requiredMist: string;
      balanceMist: string;
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
  fighterLedgerReady: boolean;
  fighterBalanceMist: string;
  promptInput: string;
  errorMessage: string | null;
  connectionStatus: WebSocketConnectionStatus;
  isContinuingPipeline: boolean;
  setPromptInput: (value: string) => void;
  setActiveSection: (sectionId: SectionId) => void;
  submitPrompt: () => Promise<void>;
  requestContinuePipeline: () => void;
  requestRegenerateSpecsheet: () => Promise<void>;
  requestRegenerateAgentCode: () => Promise<void>;
  requestRegenerateStrikecraftSpecsheetImage: () => Promise<void>;
  requestRegenerateSpritesheetImage: () => Promise<void>;
  requestRegenerateStrikecraftSpriteImage: () => Promise<void>;
  saveEditedSection: (sectionId: SectionId, content: string) => void;
};
