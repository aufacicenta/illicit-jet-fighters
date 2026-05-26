import type { NetworkEnvName } from "@ijf/shared";

import type { SectionStatus } from "../lib/pipeline-status";
import type { ChatMessage, SectionId, SectionOutput } from "../lib/types";

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
      sectionStatuses: Partial<Record<SectionId, SectionStatus>>;
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
      fighterId?: number;
      battlefieldId?: number;
      totalCostUsd: string;
      latestRunCorrelationId: string | null;
      latestRunSectionCosts: Partial<Record<SectionId, string>>;
    }
  | {
      type: "wallet:balance-update";
      walletId: string;
      networkEnv: NetworkEnvName;
      balanceMist: string;
      balanceUsd: string;
      fxNativePerUsd: string;
      at: string;
    }
  | {
      type: "wallet:topup-detected";
      txHash: string;
      amountMist: string;
      amountUsd: string;
      at: string;
    }
  | {
      type: "wallet:withdrawal-update";
      groupId: string;
      status: "pending" | "broadcasting" | "confirmed" | "refunded";
      latestTxHash?: string;
      errorMessage?: string;
      at: string;
    }
  | {
      type: "wallet:insufficient-balance";
      sectionId: SectionId;
      requiredMist: string;
      balanceMist: string;
    };

export type ClientMessage =
  | { type: "pipeline:continue" }
  | {
      type: "refine";
      sectionId: SectionId;
      message: string;
      history: ChatMessage[];
    }
  | { type: "edit"; sectionId: SectionId; content: string };
