import type { ReactNode } from "react";

import type { WebSocketConnectionStatus } from "../../hooks/useWebSocket";
import type { WalletLedgerEntry, WalletWithdrawal } from "../../lib/api";

export type WalletContextControllerProps = {
  children: ReactNode;
};

export type WalletTopupHighlight = {
  txHash: string;
  amountMist: bigint;
  expiresAt: number;
};

export type WalletSnapshotState = {
  walletId: string;
  address: string;
  network: "sui";
  balanceMist: bigint;
  balanceUsd: number;
  fxNativePerUsd: number;
};

export type WalletServerMessage =
  | {
      type: "wallet:balance-update";
      walletId: string;
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
    };

export type WalletContextType = {
  status: "idle" | "loading" | "ready" | "error";
  wallet: WalletSnapshotState | null;
  recentEntries: WalletLedgerEntry[];
  withdrawals: WalletWithdrawal[];
  wsStatus: WebSocketConnectionStatus;
  lastTopupHighlight: WalletTopupHighlight | null;
  errorMessage: string | null;
  refresh: () => Promise<void>;
  provisionIfMissing: () => Promise<void>;
  submitWithdrawal: (args: { targetAddress: string; amountMist: string }) => Promise<void>;
  cancelWithdrawal: (groupId: string) => Promise<void>;
};
