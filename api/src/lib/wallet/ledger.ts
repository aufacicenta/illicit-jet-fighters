import { randomUUID } from "node:crypto";

import {
  and,
  db,
  desc,
  eq,
  fighterLedgerEntries,
  fighters,
  inArray,
  sql,
  userWallets,
  walletLedgerEntries,
} from "@ijf/database";
import type { NetworkEnvName } from "@ijf/shared";

import type { WalletLedgerKind, WithdrawalStatus, WithdrawalView } from "./types";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | DbTransaction;

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

export const formatNativeNumeric = (value: bigint) => value.toString();

export const insertLedgerEntry = async ({
  executor,
  walletId,
  networkEnv,
  kind,
  amountNative,
  amountUsdSnapshot,
  fxNativePerUsd,
  correlationId,
  llmUsageEventId,
  parentId,
  groupId,
  txHash,
  targetAddress,
  errorMessage,
  metadata,
}: {
  executor?: DbExecutor;
  walletId: string;
  networkEnv: NetworkEnvName;
  kind: WalletLedgerKind;
  amountNative: bigint;
  amountUsdSnapshot: number;
  fxNativePerUsd: number;
  correlationId?: string;
  llmUsageEventId?: string;
  parentId?: string;
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
      networkEnv,
      kind,
      amountNative: formatNativeNumeric(amountNative),
      amountUsdSnapshot: amountUsdSnapshot.toFixed(8),
      fxNativePerUsd: fxNativePerUsd.toFixed(12),
      correlationId: correlationId ?? null,
      llmUsageEventId: llmUsageEventId ?? null,
      parentId: parentId ?? null,
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

export const getWalletBalanceNative = async (
  walletId: string,
  networkEnv: NetworkEnvName,
  executor?: DbExecutor,
): Promise<bigint> => {
  const run = executor ?? db;
  const result = await run.execute<{ total: string }>(
    sql`select coalesce(sum(amount_native), 0)::text as total
        from wallet_ledger_entries
        where wallet_id = ${walletId}
          and network_env = ${networkEnv}::public.wallet_network_env`,
  );
  return asBigInt(result.rows[0]?.total);
};

export type FighterLedgerKind =
  | "fighter_transfer_in"
  | "fighter_transfer_out"
  | "fighter_sim_bounty_in"
  | "fighter_sim_bet_out";

const parsePositiveNativeAmount = (value: bigint) => {
  if (value <= 0n) {
    throw new Error("amountNative must be a positive integer amount.");
  }
};

const toUsdSnapshot = (amountNative: bigint, fxNativePerUsd: number) => {
  if (!Number.isFinite(fxNativePerUsd) || fxNativePerUsd <= 0) {
    throw new Error("fxNativePerUsd must be a positive number.");
  }
  return Number(amountNative) / fxNativePerUsd;
};

const requireOwnedFighter = async ({
  fighterId,
  userId,
  executor,
}: {
  fighterId: number;
  userId: string;
  executor: DbExecutor;
}) => {
  const fighterRows = await executor
    .select({
      id: fighters.id,
    })
    .from(fighters)
    .where(and(eq(fighters.id, fighterId), eq(fighters.userId, userId)))
    .limit(1);
  if (!fighterRows[0]) {
    throw new Error("Fighter not found for this user.");
  }
};

export const insertFighterLedgerEntry = async ({
  executor,
  fighterId,
  kind,
  amountNative,
  walletLedgerEntryId,
  metadata,
}: {
  executor?: DbExecutor;
  fighterId: number;
  kind: FighterLedgerKind;
  amountNative: bigint;
  walletLedgerEntryId: string;
  metadata?: unknown;
}) => {
  const run = executor ?? db;
  const inserted = await run
    .insert(fighterLedgerEntries)
    .values({
      fighterId,
      kind,
      amountNative: formatNativeNumeric(amountNative),
      walletLedgerEntryId,
      metadata: (metadata as object | undefined) ?? null,
    })
    .returning({
      id: fighterLedgerEntries.id,
      createdAt: fighterLedgerEntries.createdAt,
    });
  const row = inserted[0];
  if (!row) {
    throw new Error("Unable to insert fighter ledger entry.");
  }
  return row;
};

export const getFighterBalanceNative = async (
  fighterId: number,
  executor?: DbExecutor,
): Promise<bigint> => {
  const run = executor ?? db;
  const result = await run.execute<{ total: string }>(
    sql`select coalesce(sum(amount_native), 0)::text as total
        from fighter_ledger_entries
        where fighter_id = ${fighterId}`,
  );
  return asBigInt(result.rows[0]?.total);
};

export const listFighterLedgerEntries = async ({
  fighterId,
  limit = 50,
  executor,
}: {
  fighterId: number;
  limit?: number;
  executor?: DbExecutor;
}) => {
  const run = executor ?? db;
  const cappedLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  return run
    .select({
      id: fighterLedgerEntries.id,
      kind: fighterLedgerEntries.kind,
      amountNative: fighterLedgerEntries.amountNative,
      walletLedgerEntryId: fighterLedgerEntries.walletLedgerEntryId,
      metadata: fighterLedgerEntries.metadata,
      createdAt: fighterLedgerEntries.createdAt,
    })
    .from(fighterLedgerEntries)
    .where(eq(fighterLedgerEntries.fighterId, fighterId))
    .orderBy(desc(fighterLedgerEntries.createdAt))
    .limit(cappedLimit);
};

export const appendUserToFighterTransfer = async ({
  walletId,
  userId,
  fighterId,
  networkEnv,
  amountNative,
  fxNativePerUsd,
  metadata,
}: {
  walletId: string;
  userId: string;
  fighterId: number;
  networkEnv: NetworkEnvName;
  amountNative: bigint;
  fxNativePerUsd: number;
  metadata?: Record<string, unknown>;
}) =>
  db.transaction(async (tx) => {
    parsePositiveNativeAmount(amountNative);
    await requireOwnedFighter({ fighterId, userId, executor: tx });
    const walletBalanceNative = await getWalletBalanceNative(walletId, networkEnv, tx);
    if (walletBalanceNative < amountNative) {
      throw new Error("Insufficient wallet balance.");
    }
    const amountUsdSnapshot = toUsdSnapshot(amountNative, fxNativePerUsd);
    const correlationId = randomUUID();
    const walletRow = await insertLedgerEntry({
      executor: tx,
      walletId,
      networkEnv,
      kind: "fighter_transfer_out",
      amountNative: -amountNative,
      amountUsdSnapshot: -Math.abs(amountUsdSnapshot),
      fxNativePerUsd,
      correlationId,
      metadata: {
        transferDirection: "user_to_fighter",
        fighterId,
        ...(metadata ?? {}),
      },
    });
    const fighterRow = await insertFighterLedgerEntry({
      executor: tx,
      fighterId,
      kind: "fighter_transfer_in",
      amountNative,
      walletLedgerEntryId: walletRow.id,
      metadata: {
        transferDirection: "user_to_fighter",
        walletId,
        correlationId,
        ...(metadata ?? {}),
      },
    });
    const fighterBalanceNative = await getFighterBalanceNative(fighterId, tx);
    const nextWalletBalanceNative = await getWalletBalanceNative(walletId, networkEnv, tx);
    return {
      correlationId,
      walletEntryId: walletRow.id,
      fighterEntryId: fighterRow.id,
      walletBalanceNative: nextWalletBalanceNative,
      fighterBalanceNative,
    };
  });

export const appendFighterToUserTransfer = async ({
  walletId,
  userId,
  fighterId,
  networkEnv,
  amountNative,
  fxNativePerUsd,
  metadata,
}: {
  walletId: string;
  userId: string;
  fighterId: number;
  networkEnv: NetworkEnvName;
  amountNative: bigint;
  fxNativePerUsd: number;
  metadata?: Record<string, unknown>;
}) =>
  db.transaction(async (tx) => {
    parsePositiveNativeAmount(amountNative);
    await requireOwnedFighter({ fighterId, userId, executor: tx });
    const fighterBalanceNative = await getFighterBalanceNative(fighterId, tx);
    if (fighterBalanceNative < amountNative) {
      throw new Error("Insufficient fighter balance.");
    }
    const amountUsdSnapshot = toUsdSnapshot(amountNative, fxNativePerUsd);
    const correlationId = randomUUID();
    const walletRow = await insertLedgerEntry({
      executor: tx,
      walletId,
      networkEnv,
      kind: "fighter_transfer_in",
      amountNative,
      amountUsdSnapshot: Math.abs(amountUsdSnapshot),
      fxNativePerUsd,
      correlationId,
      metadata: {
        transferDirection: "fighter_to_user",
        fighterId,
        ...(metadata ?? {}),
      },
    });
    const fighterRow = await insertFighterLedgerEntry({
      executor: tx,
      fighterId,
      kind: "fighter_transfer_out",
      amountNative: -amountNative,
      walletLedgerEntryId: walletRow.id,
      metadata: {
        transferDirection: "fighter_to_user",
        walletId,
        correlationId,
        ...(metadata ?? {}),
      },
    });
    const nextFighterBalanceNative = await getFighterBalanceNative(fighterId, tx);
    const walletBalanceNative = await getWalletBalanceNative(walletId, networkEnv, tx);
    return {
      correlationId,
      walletEntryId: walletRow.id,
      fighterEntryId: fighterRow.id,
      walletBalanceNative,
      fighterBalanceNative: nextFighterBalanceNative,
    };
  });

export const appendSimulationSettlement = async ({
  losingOwnerUserId,
  losingOwnerWalletId,
  losingFighterId,
  winningFighterId,
  networkEnv,
  amountNative,
  fxNativePerUsd,
  metadata,
}: {
  losingOwnerUserId: string;
  losingOwnerWalletId: string;
  losingFighterId: number;
  winningFighterId: number;
  networkEnv: NetworkEnvName;
  amountNative: bigint;
  fxNativePerUsd: number;
  metadata?: Record<string, unknown>;
}) =>
  db.transaction(async (tx) => {
    parsePositiveNativeAmount(amountNative);
    const ownedFighterRows = await tx
      .select({
        id: fighters.id,
        userId: fighters.userId,
      })
      .from(fighters)
      .where(inArray(fighters.id, [losingFighterId, winningFighterId]));
    const losingFighter = ownedFighterRows.find((row) => row.id === losingFighterId);
    const winningFighter = ownedFighterRows.find((row) => row.id === winningFighterId);
    if (!losingFighter || !winningFighter) {
      throw new Error("Simulation settlement requires valid fighters.");
    }
    if (losingFighter.userId !== losingOwnerUserId) {
      throw new Error("Losing fighter does not belong to specified owner.");
    }
    const walletRows = await tx
      .select({
        id: userWallets.id,
      })
      .from(userWallets)
      .where(
        and(eq(userWallets.id, losingOwnerWalletId), eq(userWallets.userId, losingOwnerUserId)),
      )
      .limit(1);
    if (!walletRows[0]) {
      throw new Error("Losing owner's wallet was not found.");
    }
    const losingFighterBalanceNative = await getFighterBalanceNative(losingFighterId, tx);
    if (losingFighterBalanceNative < amountNative) {
      throw new Error("Insufficient losing fighter balance for settlement.");
    }
    const amountUsdSnapshot = toUsdSnapshot(amountNative, fxNativePerUsd);
    const correlationId = randomUUID();
    const ownerCredit = await insertLedgerEntry({
      executor: tx,
      walletId: losingOwnerWalletId,
      networkEnv,
      kind: "fighter_transfer_in",
      amountNative,
      amountUsdSnapshot: Math.abs(amountUsdSnapshot),
      fxNativePerUsd,
      correlationId,
      metadata: {
        settlementLeg: "losing_fighter_to_owner_wallet",
        losingFighterId,
        winningFighterId,
        ...(metadata ?? {}),
      },
    });
    const loserDebit = await insertFighterLedgerEntry({
      executor: tx,
      fighterId: losingFighterId,
      kind: "fighter_sim_bet_out",
      amountNative: -amountNative,
      walletLedgerEntryId: ownerCredit.id,
      metadata: {
        settlementLeg: "losing_fighter_to_owner_wallet",
        ownerWalletId: losingOwnerWalletId,
        correlationId,
        ...(metadata ?? {}),
      },
    });
    const ownerDebit = await insertLedgerEntry({
      executor: tx,
      walletId: losingOwnerWalletId,
      networkEnv,
      kind: "fighter_transfer_out",
      amountNative: -amountNative,
      amountUsdSnapshot: -Math.abs(amountUsdSnapshot),
      fxNativePerUsd,
      correlationId,
      metadata: {
        settlementLeg: "owner_wallet_to_winning_fighter",
        losingFighterId,
        winningFighterId,
        ...(metadata ?? {}),
      },
    });
    const winnerCredit = await insertFighterLedgerEntry({
      executor: tx,
      fighterId: winningFighterId,
      kind: "fighter_sim_bounty_in",
      amountNative,
      walletLedgerEntryId: ownerDebit.id,
      metadata: {
        settlementLeg: "owner_wallet_to_winning_fighter",
        ownerWalletId: losingOwnerWalletId,
        correlationId,
        ...(metadata ?? {}),
      },
    });
    return {
      correlationId,
      ownerCreditWalletEntryId: ownerCredit.id,
      ownerDebitWalletEntryId: ownerDebit.id,
      losingFighterEntryId: loserDebit.id,
      winningFighterEntryId: winnerCredit.id,
    };
  });

export const appendWithdrawalRequest = async ({
  executor,
  walletId,
  networkEnv,
  targetAddress,
  amountNative,
  amountUsdSnapshot,
  fxNativePerUsd,
}: {
  executor?: DbExecutor;
  walletId: string;
  networkEnv: NetworkEnvName;
  targetAddress: string;
  amountNative: bigint;
  amountUsdSnapshot: number;
  fxNativePerUsd: number;
}) => {
  const groupId = randomUUID();
  await insertLedgerEntry({
    executor,
    walletId,
    networkEnv,
    kind: "withdrawal_request",
    amountNative: -amountNative,
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
  networkEnv,
  groupId,
  txHash,
}: {
  executor?: DbExecutor;
  walletId: string;
  networkEnv: NetworkEnvName;
  groupId: string;
  txHash: string;
}) =>
  insertLedgerEntry({
    executor,
    walletId,
    networkEnv,
    kind: "withdrawal_broadcast",
    amountNative: 0n,
    amountUsdSnapshot: 0,
    fxNativePerUsd: 0,
    groupId,
    txHash,
  });

export const appendWithdrawalConfirm = async ({
  executor,
  walletId,
  networkEnv,
  groupId,
  txHash,
}: {
  executor?: DbExecutor;
  walletId: string;
  networkEnv: NetworkEnvName;
  groupId: string;
  txHash: string;
}) =>
  insertLedgerEntry({
    executor,
    walletId,
    networkEnv,
    kind: "withdrawal_confirm",
    amountNative: 0n,
    amountUsdSnapshot: 0,
    fxNativePerUsd: 0,
    groupId,
    txHash,
  });

export const appendWithdrawalRefund = async ({
  executor,
  walletId,
  networkEnv,
  groupId,
  errorMessage,
}: {
  executor?: DbExecutor;
  walletId: string;
  networkEnv: NetworkEnvName;
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
    .where(
      and(
        eq(walletLedgerEntries.groupId, groupId),
        eq(walletLedgerEntries.walletId, walletId),
        eq(walletLedgerEntries.networkEnv, networkEnv),
      ),
    )
    .orderBy(desc(walletLedgerEntries.createdAt))
    .limit(1);

  const request = rows.find((row) => Number.parseFloat(row.amountNative) < 0);
  if (!request) {
    throw new Error("Cannot refund withdrawal without a prior request row.");
  }

  return insertLedgerEntry({
    executor: run,
    walletId,
    networkEnv,
    kind: "withdrawal_refund",
    amountNative: BigInt(request.amountNative.replace("-", "")),
    amountUsdSnapshot: Math.abs(Number.parseFloat(request.amountUsdSnapshot)),
    fxNativePerUsd: Number.parseFloat(request.fxNativePerUsd),
    groupId,
    errorMessage,
  });
};

export const getWithdrawalStatus = async ({
  walletId,
  networkEnv,
  groupId,
  executor,
}: {
  walletId: string;
  networkEnv: NetworkEnvName;
  groupId: string;
  executor?: DbExecutor;
}): Promise<WithdrawalStatus> => {
  const run = executor ?? db;
  const rows = await run
    .select({
      kind: walletLedgerEntries.kind,
    })
    .from(walletLedgerEntries)
    .where(
      and(
        eq(walletLedgerEntries.groupId, groupId),
        eq(walletLedgerEntries.walletId, walletId),
        eq(walletLedgerEntries.networkEnv, networkEnv),
      ),
    );

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
  networkEnv: NetworkEnvName,
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
    .where(
      and(
        eq(walletLedgerEntries.walletId, walletId),
        eq(walletLedgerEntries.networkEnv, networkEnv),
      ),
    )
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
      amountNative: asBigInt(request.amountNative) * -1n,
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
