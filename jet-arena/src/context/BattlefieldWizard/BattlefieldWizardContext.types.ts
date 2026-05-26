import type { ReactNode } from "react";

import type { ChatMessage } from "../../lib/api";

export type BattlefieldWizardContextControllerProps = {
  battlefieldId: string;
  children: ReactNode;
};

export type BattlefieldSectionId =
  | "battlefield-description"
  | "battlefield-sheet-prompt"
  | "battlefield-sheet-image"
  | "battlefield-config";

export type BattlefieldSectionStatus =
  | "locked"
  | "ready"
  | "generating"
  | "complete"
  | "error"
  | "blocked";

export type BattlefieldSectionOutput = {
  sectionId: BattlefieldSectionId;
  content: string;
  generatedAt: string;
  model: string;
  mimeType?: string;
  assetUrl?: string;
};

export type BattlefieldServerMessage =
  | { type: "section:start"; sectionId: BattlefieldSectionId }
  | { type: "section:delta"; sectionId: BattlefieldSectionId; delta: string }
  | {
      type: "section:complete";
      sectionId: BattlefieldSectionId;
      output: BattlefieldSectionOutput;
    }
  | {
      type: "section:error";
      sectionId: BattlefieldSectionId;
      error: string;
      code?: "INSUFFICIENT_BALANCE" | "BILLING_FAILED";
      requiredNative?: string;
      balanceNative?: string;
    }
  | { type: "pipeline:complete" }
  | { type: "pipeline:gate"; sectionId: BattlefieldSectionId; message: string }
  | {
      type: "pipeline:sync";
      sectionStatuses: Record<BattlefieldSectionId, BattlefieldSectionStatus>;
      outputs: Partial<Record<BattlefieldSectionId, BattlefieldSectionOutput>>;
      histories: Partial<Record<BattlefieldSectionId, ChatMessage[]>>;
      gateMessage: string | null;
    }
  | {
      type: "pipeline:cost-update";
      battlefieldId?: number;
      totalCostUsd: string;
      latestRunCorrelationId: string | null;
      latestRunSectionCosts: Partial<Record<BattlefieldSectionId, string>>;
    }
  | {
      type: "wallet:insufficient-balance";
      sectionId: BattlefieldSectionId;
      requiredNative: string;
      balanceNative: string;
    };

export type WebSocketConnectionStatus = "connecting" | "open" | "closed";

export type BattlefieldWizardContextType = {
  battlefieldId: string;
  originalBriefing: string | null;
  activeSectionId: BattlefieldSectionId | null;
  sectionStatuses: Record<BattlefieldSectionId, BattlefieldSectionStatus>;
  outputs: Partial<Record<BattlefieldSectionId, BattlefieldSectionOutput>>;
  sectionHistories: Partial<Record<BattlefieldSectionId, ChatMessage[]>>;
  gateMessage: string | null;
  promptInput: string;
  errorMessage: string | null;
  connectionStatus: WebSocketConnectionStatus;
  setPromptInput: (value: string) => void;
  setActiveSection: (sectionId: BattlefieldSectionId) => void;
  submitPrompt: () => Promise<void>;
  requestContinuePipeline: () => void;
  requestRegenerateSheet: () => Promise<void>;
  requestRegenerateConfig: () => Promise<void>;
};
