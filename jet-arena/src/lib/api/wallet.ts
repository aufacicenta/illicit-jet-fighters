import type { WalletSnapshot } from "@ijf/shared";
import { walletSnapshotSchema } from "@ijf/shared";

import { apiRoutes } from "../../hooks/useRoutes";
import { authHeadersJson, readErrorText } from "./client";

export type WalletLedgerEntry = {
  id: string;
  kind: string;
  amountNative: string;
  feeAmountNative: string;
  amountUsdSnapshot: string;
  fxNativePerUsd: string;
  correlationId: string | null;
  llmUsageEventId: string | null;
  groupId: string | null;
  txHash: string | null;
  targetAddress: string | null;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: string;
};

export type WalletLedgerPage = {
  walletId: string;
  entries: WalletLedgerEntry[];
  nextCursor: string | null;
};

export type WalletWithdrawal = {
  groupId: string;
  targetAddress: string;
  amountNative: string;
  status: "pending" | "broadcasting" | "confirmed" | "refunded";
  latestTxHash: string | null;
  requestedAt: string;
  settledAt: string | null;
  errorMessage: string | null;
};

export const fetchWalletSnapshot = async (): Promise<WalletSnapshot> => {
  const response = await fetch(apiRoutes.walletMe, {
    method: "GET",
    headers: {
      ...authHeadersJson(),
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }
  return walletSnapshotSchema.parse(await response.json()) as WalletSnapshot;
};

export const fetchWalletLedger = async ({
  limit = 50,
  cursor,
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<WalletLedgerPage> => {
  const url = new URL(apiRoutes.walletLedger, window.location.origin);
  url.searchParams.set("limit", String(limit));
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      ...authHeadersJson(),
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }
  return (await response.json()) as WalletLedgerPage;
};

export const fetchWalletWithdrawals = async (): Promise<{
  walletId: string;
  withdrawals: WalletWithdrawal[];
}> => {
  const response = await fetch(apiRoutes.walletWithdrawals, {
    method: "GET",
    headers: {
      ...authHeadersJson(),
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }
  return (await response.json()) as { walletId: string; withdrawals: WalletWithdrawal[] };
};

export const postWalletWithdrawal = async ({
  targetAddress,
  amountNative,
}: {
  targetAddress: string;
  amountNative: string;
}) => {
  const response = await fetch(apiRoutes.walletWithdrawals, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeadersJson(),
    },
    body: JSON.stringify({ targetAddress, amountNative }),
  });
  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }
  return (await response.json()) as {
    walletId: string;
    groupId: string;
    amountNative: string;
    targetAddress: string;
    status: "pending";
  };
};

export const cancelWalletWithdrawal = async (groupId: string) => {
  const response = await fetch(apiRoutes.walletCancelWithdrawal(groupId), {
    method: "POST",
    headers: {
      ...authHeadersJson(),
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }
  return (await response.json()) as { status: "cancelled"; groupId: string };
};
