import { randomUUID } from "node:crypto";

import { db, desc, eq, sql, walletLedgerEntries } from "@ijf/database";

import type { WalletLedgerKind, WithdrawalStatus, WithdrawalView } from "./types";

type DbExecutor = typeof db;

const asBigInt = (value: unknown) => {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    return BigInt(value);
  }
  return 0n;
};

const asDate = (value: unknown) => (value instanceof Date ? value : new Date(String(value ?? "")));

export const formatMistNumeric = (value: bigint) => value.toString();

export const insertLedgerEntry = async ({
  executor,
  walletId,
  kind,
  amountMist,
  amountUsdSnapshot,
  fxNativePerUsd,
  correlationId,
  llmUsageEventId,
  groupId,
  txHash,
  targetAddress,
  errorMessage,
  metadata,
}: {
  executor?: DbExecutor;
  walletId: string;
  kind: WalletLedgerKind;
  amountMist: bigint;
  amountUsdSnapshot: number;
  fxNativePerUsd: number;
  correlationId?: string;
  llmUsageEventId?: string;
  groupId?: string;
  txHash?: string;
  targetAddress?: string;
  errorMessage?: string;
  metadata?: unknown;
}) => {
  const run = executor ?? db;

  const inserted = await run
    .insert(walletLedgerEntries)
    .values({
      walletId,
      kind,
      amountNative: formatMistNumeric(amountMist),
      amountUsdSnapshot: amountUsdSnapshot.toFixed(8),
      fxNativePerUsd: fxNativePerUsd.toFixed(12),
      correlationId: correlationId ?? null,
      llmUsageEventId: llmUsageEventId ?? null,
      groupId: groupId ?? null,
      txHash: txHash ?? null,
      targetAddress: targetAddress ?? null,
      errorMessage: errorMessage ?? null,
      metadata: (metadata as object | undefined) ?? null,
    })
    .returning({
      id: walletLedgerEntries.id,
      createdAt: walletLedgerEntries.createdAt,
    });

  const row = inserted[0];
  if (!row) {
    throw new Error("Unable to insert wallet ledger entry.");
  }
  return row;
};

export const getWalletBalanceMist = async (
  walletId: string,
  executor?: DbExecutor,
): Promise<bigint> => {
  const run = executor ?? db;
  const result = await run.execute<{ total: string }>(
    sql`select coalesce(sum(amount_native), 0)::text as total from wallet_ledger_entries where wallet_id = ${walletId}`,
  );
  return asBigInt(result.rows[0]?.total);
};

export const appendWithdrawalRequest = async ({
  executor,
  walletId,
  targetAddress,
  amountMist,
  amountUsdSnapshot,
  fxNativePerUsd,
}: {
  executor?: DbExecutor;
  walletId: string;
  targetAddress: string;
  amountMist: bigint;
  amountUsdSnapshot: number;
  fxNativePerUsd: number;
}) => {
  const groupId = randomUUID();
  await insertLedgerEntry({
    executor,
    walletId,
    kind: "withdrawal_request",
    amountMist: -amountMist,
    amountUsdSnapshot: -Math.abs(amountUsdSnapshot),
    fxNativePerUsd,
    groupId,
    targetAddress,
  });

  return groupId;
};

export const appendWithdrawalBroadcast = async ({
  executor,
  walletId,
  groupId,
  txHash,
}: {
  executor?: DbExecutor;
  walletId: string;
  groupId: string;
  txHash: string;
}) =>
  insertLedgerEntry({
    executor,
    walletId,
    kind: "withdrawal_broadcast",
    amountMist: 0n,
    amountUsdSnapshot: 0,
    fxNativePerUsd: 0,
    groupId,
    txHash,
  });

export const appendWithdrawalConfirm = async ({
  executor,
  walletId,
  groupId,
  txHash,
}: {
  executor?: DbExecutor;
  walletId: string;
  groupId: string;
  txHash: string;
}) =>
  insertLedgerEntry({
    executor,
    walletId,
    kind: "withdrawal_confirm",
    amountMist: 0n,
    amountUsdSnapshot: 0,
    fxNativePerUsd: 0,
    groupId,
    txHash,
  });

export const appendWithdrawalRefund = async ({
  executor,
  walletId,
  groupId,
  errorMessage,
}: {
  executor?: DbExecutor;
  walletId: string;
  groupId: string;
  errorMessage?: string;
}) => {
  const run = executor ?? db;
  const rows = await run
    .select({
      amountNative: walletLedgerEntries.amountNative,
      amountUsdSnapshot: walletLedgerEntries.amountUsdSnapshot,
      fxNativePerUsd: walletLedgerEntries.fxNativePerUsd,
    })
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.groupId, groupId))
    .orderBy(desc(walletLedgerEntries.createdAt))
    .limit(1);

  const request = rows.find((row) => Number.parseFloat(row.amountNative) < 0);
  if (!request) {
    throw new Error("Cannot refund withdrawal without a prior request row.");
  }

  return insertLedgerEntry({
    executor: run,
    walletId,
    kind: "withdrawal_refund",
    amountMist: BigInt(request.amountNative.replace("-", "")),
    amountUsdSnapshot: Math.abs(Number.parseFloat(request.amountUsdSnapshot)),
    fxNativePerUsd: Number.parseFloat(request.fxNativePerUsd),
    groupId,
    errorMessage,
  });
};

export const getWithdrawalStatus = async ({
  walletId,
  groupId,
  executor,
}: {
  walletId: string;
  groupId: string;
  executor?: DbExecutor;
}): Promise<WithdrawalStatus> => {
  const run = executor ?? db;
  const rows = await run
    .select({
      kind: walletLedgerEntries.kind,
    })
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.groupId, groupId));

  const hasKind = (kind: WalletLedgerKind) => rows.some((row) => row.kind === kind);
  if (hasKind("withdrawal_confirm")) {
    return "confirmed";
  }
  if (hasKind("withdrawal_refund")) {
    return "refunded";
  }
  if (hasKind("withdrawal_broadcast")) {
    return "broadcasting";
  }
  if (hasKind("withdrawal_request")) {
    return "pending";
  }

  throw new Error(`Unknown withdrawal group: ${groupId} for wallet ${walletId}.`);
};

export const listWithdrawals = async (
  walletId: string,
  executor?: DbExecutor,
): Promise<WithdrawalView[]> => {
  const run = executor ?? db;
  const rows = await run
    .select({
      groupId: walletLedgerEntries.groupId,
      kind: walletLedgerEntries.kind,
      amountNative: walletLedgerEntries.amountNative,
      txHash: walletLedgerEntries.txHash,
      targetAddress: walletLedgerEntries.targetAddress,
      errorMessage: walletLedgerEntries.errorMessage,
      createdAt: walletLedgerEntries.createdAt,
    })
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.walletId, walletId))
    .orderBy(desc(walletLedgerEntries.createdAt));

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.groupId) {
      continue;
    }
    const existing = grouped.get(row.groupId) ?? [];
    existing.push(row);
    grouped.set(row.groupId, existing);
  }

  const withdrawals: WithdrawalView[] = [];
  for (const [groupId, groupRows] of grouped) {
    const request = groupRows.find((row) => row.kind === "withdrawal_request");
    if (!request) {
      continue;
    }

    const status: WithdrawalStatus = groupRows.some((row) => row.kind === "withdrawal_confirm")
      ? "confirmed"
      : groupRows.some((row) => row.kind === "withdrawal_refund")
        ? "refunded"
        : groupRows.some((row) => row.kind === "withdrawal_broadcast")
          ? "broadcasting"
          : "pending";

    const latestTxHash =
      groupRows.find((row) => row.kind === "withdrawal_confirm")?.txHash ??
      groupRows.find((row) => row.kind === "withdrawal_broadcast")?.txHash ??
      null;
    const terminal = groupRows.find(
      (row) => row.kind === "withdrawal_confirm" || row.kind === "withdrawal_refund",
    );

    withdrawals.push({
      groupId,
      targetAddress: request.targetAddress ?? "",
      amountMist: asBigInt(request.amountNative) * -1n,
      status,
      latestTxHash,
      requestedAt: asDate(request.createdAt),
      settledAt: terminal ? asDate(terminal.createdAt) : null,
      errorMessage:
        groupRows.find((row) => row.kind === "withdrawal_refund" && row.errorMessage)
          ?.errorMessage ?? null,
    });
  }

  return withdrawals.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
};
