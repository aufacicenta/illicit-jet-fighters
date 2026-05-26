import type { NetworkEnvName, WalletCurrencyMetadata } from "@ijf/shared";
import type { ReactNode } from "react";

import type { WebSocketConnectionStatus } from "../../hooks/useWebSocket";
import type { WalletLedgerEntry, WalletWithdrawal } from "../../lib/api";

export type WalletContextControllerProps = {
  children: ReactNode;
};

export type WalletTopupHighlight = {
  txHash: string;
  amountNative: bigint;
  expiresAt: number;
};

export type WalletSnapshotState = {
  walletId: string;
  address: string;
  network: "sui";
  currency: WalletCurrencyMetadata;
  networkEnv: NetworkEnvName;
  balanceNative: bigint;
  balanceUsd: number;
  fxNativePerUsd: number;
};

export type WalletServerMessage =
  | {
      type: "wallet:balance-update";
      walletId: string;
      networkEnv: NetworkEnvName;
      balanceNative: string;
      balanceUsd: string;
      fxNativePerUsd: string;
      at: string;
    }
  | {
      type: "wallet:topup-detected";
      txHash: string;
      amountNative: string;
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
  submitWithdrawal: (args: { targetAddress: string; amountNative: string }) => Promise<void>;
  cancelWithdrawal: (groupId: string) => Promise<void>;
};
