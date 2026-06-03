import { randomUUID } from "node:crypto";

import { db, eq, fighterLedgerEntries, sql } from "@ijf/database";

import { getFighterBalanceNative, insertFighterLedgerEntry } from "../wallet/ledger";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const parsePositiveNativeAmount = (value: bigint) => {
  if (value <= 0n) {
    throw new Error("amountNative must be a positive integer amount.");
  }
};

export const getFighterAvailableBalanceNative = async (
  fighterId: number,
  executor?: typeof db | DbTransaction,
) => getFighterBalanceNative(fighterId, executor);

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
  executor?: typeof db | DbTransaction;
}) => {
  parsePositiveNativeAmount(amountNative);
  const run = executor ?? db;
  const balance = await getFighterBalanceNative(fighterId, run);
  if (balance < amountNative) {
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
  reason: "cancelled" | "draw" | "settlement_prep";
  executor?: typeof db | DbTransaction;
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
  executor?: typeof db | DbTransaction;
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

export const findOpenLockCorrelationIds = async (fighterId: number) => {
  const rows = await db
    .select({
      correlationId: sql<string>`metadata->>'correlationId'`,
      amountNative: fighterLedgerEntries.amountNative,
      kind: fighterLedgerEntries.kind,
    })
    .from(fighterLedgerEntries)
    .where(eq(fighterLedgerEntries.fighterId, fighterId));

  const netByCorrelation = new Map<string, bigint>();
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
  }

  return [...netByCorrelation.entries()]
    .filter(([, net]) => net < 0n)
    .map(([correlationId, net]) => ({ correlationId, lockedAmountNative: -net }));
};
