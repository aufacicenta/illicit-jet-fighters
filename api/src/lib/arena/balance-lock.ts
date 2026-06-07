import { randomUUID } from "node:crypto";

import { and, arenaQueueEntries, db, eq, fighterLedgerEntries, fighters, sql } from "@ijf/database";
import { computeAvailableBalanceNative } from "@ijf/shared";

import { getOwnedFighter } from "../fighter-access";
import { getFighterBalanceNative, insertFighterLedgerEntry } from "../wallet/ledger";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | DbTransaction;

export type OpenArenaLock = {
  correlationId: string;
  lockedAmountNative: bigint;
  poolId: string | null;
};

const parsePositiveNativeAmount = (value: bigint) => {
  if (value <= 0n) {
    throw new Error("amountNative must be a positive integer amount.");
  }
};

export const findOpenArenaLocks = async (
  fighterId: number,
  executor?: DbExecutor,
): Promise<OpenArenaLock[]> => {
  const run = executor ?? db;
  const rows = await run
    .select({
      correlationId: sql<string>`metadata->>'correlationId'`,
      amountNative: fighterLedgerEntries.amountNative,
      kind: fighterLedgerEntries.kind,
      poolId: sql<string | null>`metadata->>'poolId'`,
    })
    .from(fighterLedgerEntries)
    .where(eq(fighterLedgerEntries.fighterId, fighterId));

  const netByCorrelation = new Map<string, bigint>();
  const poolIdByCorrelation = new Map<string, string | null>();

  for (const row of rows) {
    if (row.kind !== "fighter_arena_lock" && row.kind !== "fighter_arena_unlock") {
      continue;
    }
    const correlationId = row.correlationId;
    if (!correlationId) {
      continue;
    }
    const current = netByCorrelation.get(correlationId) ?? 0n;
    netByCorrelation.set(correlationId, current + BigInt(row.amountNative));
    if (row.kind === "fighter_arena_lock" && row.poolId) {
      poolIdByCorrelation.set(correlationId, row.poolId);
    }
  }

  return [...netByCorrelation.entries()]
    .filter(([, net]) => net < 0n)
    .map(([correlationId, net]) => ({
      correlationId,
      lockedAmountNative: -net,
      poolId: poolIdByCorrelation.get(correlationId) ?? null,
    }));
};

export const getFighterLockedBalanceNative = async (
  fighterId: number,
  executor?: DbExecutor,
): Promise<bigint> => {
  const locks = await findOpenArenaLocks(fighterId, executor);
  return locks.reduce((sum, lock) => sum + lock.lockedAmountNative, 0n);
};

export const getFighterAvailableBalanceNative = async (
  fighterId: number,
  executor?: DbExecutor,
): Promise<bigint> => {
  const balanceNative = await getFighterBalanceNative(fighterId, executor);
  const lockedBalanceNative = await getFighterLockedBalanceNative(fighterId, executor);
  return computeAvailableBalanceNative(balanceNative, lockedBalanceNative);
};

export const buildFighterBalanceSnapshot = async (fighterId: number, executor?: DbExecutor) => {
  const balanceNative = await getFighterBalanceNative(fighterId, executor);
  const lockedBalanceNative = await getFighterLockedBalanceNative(fighterId, executor);
  const availableBalanceNative = computeAvailableBalanceNative(balanceNative, lockedBalanceNative);
  const openArenaLocks = await findOpenArenaLocks(fighterId, executor);

  return {
    fighterBalanceNative: balanceNative,
    lockedBalanceNative,
    availableBalanceNative,
    openArenaLocks,
  };
};

export const lockFighterStake = async ({
  fighterId,
  amountNative,
  poolId,
  correlationId = randomUUID(),
  executor,
}: {
  fighterId: number;
  amountNative: bigint;
  poolId: string;
  correlationId?: string;
  executor?: DbExecutor;
}) => {
  parsePositiveNativeAmount(amountNative);
  const run = executor ?? db;
  const available = await getFighterAvailableBalanceNative(fighterId, run);
  if (available < amountNative) {
    throw new Error("Insufficient fighter balance for arena stake lock.");
  }

  await insertFighterLedgerEntry({
    executor: run,
    fighterId,
    kind: "fighter_arena_lock",
    amountNative: -amountNative,
    metadata: {
      poolId,
      correlationId,
      lockLeg: "arena_stake_lock",
    },
  });

  return { correlationId };
};

export const unlockFighterStake = async ({
  fighterId,
  amountNative,
  correlationId,
  poolId,
  reason,
  executor,
}: {
  fighterId: number;
  amountNative: bigint;
  correlationId: string;
  poolId?: string;
  reason: "cancelled" | "draw" | "manual" | "settlement_prep";
  executor?: DbExecutor;
}) => {
  parsePositiveNativeAmount(amountNative);
  const run = executor ?? db;

  await insertFighterLedgerEntry({
    executor: run,
    fighterId,
    kind: "fighter_arena_unlock",
    amountNative,
    metadata: {
      poolId: poolId ?? null,
      correlationId,
      unlockLeg: reason,
    },
  });
};

export const getLockedAmountForCorrelation = async ({
  fighterId,
  correlationId,
  executor,
}: {
  fighterId: number;
  correlationId: string;
  executor?: DbExecutor;
}) => {
  const run = executor ?? db;
  const result = await run.execute<{ total: string }>(
    sql`select coalesce(sum(amount_native), 0)::text as total
        from fighter_ledger_entries
        where fighter_id = ${fighterId}
          and kind in ('fighter_arena_lock', 'fighter_arena_unlock')
          and metadata->>'correlationId' = ${correlationId}`,
  );
  const net = BigInt(result.rows[0]?.total ?? "0");
  return net < 0n ? -net : 0n;
};

/** @deprecated Use findOpenArenaLocks instead. */
export const findOpenLockCorrelationIds = async (fighterId: number) => {
  const locks = await findOpenArenaLocks(fighterId);
  return locks.map(({ correlationId, lockedAmountNative }) => ({
    correlationId,
    lockedAmountNative,
  }));
};

export const manualUnlockFighterStake = async ({
  fighterId,
  userId,
  correlationId,
}: {
  fighterId: number;
  userId: string;
  correlationId: string;
}) => {
  const ownedFighter = await getOwnedFighter(fighterId, userId);
  if (!ownedFighter) {
    throw new Error("Fighter not found.");
  }

  return db.transaction(async (tx) => {
    const lockedAmountNative = await getLockedAmountForCorrelation({
      fighterId,
      correlationId,
      executor: tx,
    });
    if (lockedAmountNative <= 0n) {
      throw new Error("No open arena lock found for this correlation.");
    }

    const fighterRows = await tx
      .select({ arenaStatus: fighters.arenaStatus })
      .from(fighters)
      .where(eq(fighters.id, fighterId))
      .limit(1);
    const arenaStatus = fighterRows[0]?.arenaStatus;
    if (!arenaStatus || arenaStatus !== "idle") {
      throw new Error("Fighter must be idle to manually unlock arena stake.");
    }

    const queuedRows = await tx
      .select({ id: arenaQueueEntries.id })
      .from(arenaQueueEntries)
      .where(
        and(
          eq(arenaQueueEntries.fighterId, fighterId),
          eq(arenaQueueEntries.status, "queued"),
          eq(arenaQueueEntries.lockCorrelationId, correlationId),
        ),
      )
      .limit(1);
    if (queuedRows[0]) {
      throw new Error("Leave the arena queue instead of unlocking while queued.");
    }

    const openLocks = await findOpenArenaLocks(fighterId, tx);
    const openLock = openLocks.find((lock) => lock.correlationId === correlationId);
    if (!openLock) {
      throw new Error("No open arena lock found for this correlation.");
    }

    await unlockFighterStake({
      fighterId,
      amountNative: lockedAmountNative,
      correlationId,
      poolId: openLock.poolId ?? undefined,
      reason: "manual",
      executor: tx,
    });

    const snapshot = await buildFighterBalanceSnapshot(fighterId, tx);
    return {
      correlationId,
      unlockedAmountNative: lockedAmountNative,
      ...snapshot,
    };
  });
};
