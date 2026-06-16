import type { ArenaBattleMode } from "@ijf/database";
import {
  and,
  arenaPools,
  arenaQueueEntries,
  asc,
  broadcasts,
  db,
  eq,
  fighters,
  inArray,
  simulations,
  sql,
} from "@ijf/database";

export type ArenaPoolRecord = {
  id: string;
  network: string;
  battleMode: ArenaBattleMode;
  stakeAmountNative: string;
  minFighters: number;
  maxFighters: number;
  isActive: boolean;
  queuedCount: number;
};

export type ArenaQueueEntryRecord = {
  id: string;
  poolId: string;
  fighterId: number;
  userId: string;
  status: "queued" | "matched" | "cancelled";
  simulationId: string | null;
  lockCorrelationId: string | null;
  agentVersionId: string | null;
  queuedAt: Date;
  matchedAt: Date | null;
};

export const listActivePools = async (): Promise<ArenaPoolRecord[]> => {
  const pools = await db
    .select({
      id: arenaPools.id,
      network: arenaPools.network,
      battleMode: arenaPools.battleMode,
      stakeAmountNative: arenaPools.stakeAmountNative,
      minFighters: arenaPools.minFighters,
      maxFighters: arenaPools.maxFighters,
      isActive: arenaPools.isActive,
    })
    .from(arenaPools)
    .where(eq(arenaPools.isActive, true))
    .orderBy(asc(arenaPools.stakeAmountNative), asc(arenaPools.battleMode));

  if (pools.length === 0) {
    return [];
  }

  const counts = await db
    .select({
      poolId: arenaQueueEntries.poolId,
      queuedCount: sql<number>`count(*)::int`,
    })
    .from(arenaQueueEntries)
    .where(eq(arenaQueueEntries.status, "queued"))
    .groupBy(arenaQueueEntries.poolId);

  const countByPoolId = new Map(counts.map((row) => [row.poolId, row.queuedCount]));

  return pools.map((pool) => ({
    ...pool,
    queuedCount: countByPoolId.get(pool.id) ?? 0,
  }));
};

export const getPoolById = async (poolId: string) => {
  const rows = await db
    .select({
      id: arenaPools.id,
      network: arenaPools.network,
      battleMode: arenaPools.battleMode,
      stakeAmountNative: arenaPools.stakeAmountNative,
      minFighters: arenaPools.minFighters,
      maxFighters: arenaPools.maxFighters,
      isActive: arenaPools.isActive,
    })
    .from(arenaPools)
    .where(eq(arenaPools.id, poolId))
    .limit(1);

  const pool = rows[0];
  if (!pool) {
    return null;
  }

  const countRows = await db
    .select({
      queuedCount: sql<number>`count(*)::int`,
    })
    .from(arenaQueueEntries)
    .where(and(eq(arenaQueueEntries.poolId, poolId), eq(arenaQueueEntries.status, "queued")));

  return {
    ...pool,
    queuedCount: countRows[0]?.queuedCount ?? 0,
  } satisfies ArenaPoolRecord;
};

export const getQueuedEntriesForPool = async (poolId: string): Promise<ArenaQueueEntryRecord[]> =>
  db
    .select({
      id: arenaQueueEntries.id,
      poolId: arenaQueueEntries.poolId,
      fighterId: arenaQueueEntries.fighterId,
      userId: arenaQueueEntries.userId,
      status: arenaQueueEntries.status,
      simulationId: arenaQueueEntries.simulationId,
      lockCorrelationId: arenaQueueEntries.lockCorrelationId,
      agentVersionId: arenaQueueEntries.agentVersionId,
      queuedAt: arenaQueueEntries.queuedAt,
      matchedAt: arenaQueueEntries.matchedAt,
    })
    .from(arenaQueueEntries)
    .where(and(eq(arenaQueueEntries.poolId, poolId), eq(arenaQueueEntries.status, "queued")))
    .orderBy(asc(arenaQueueEntries.queuedAt));

export const getActiveFighterQueueEntry = async (
  fighterId: number,
): Promise<ArenaQueueEntryRecord | null> => {
  const rows = await db
    .select({
      id: arenaQueueEntries.id,
      poolId: arenaQueueEntries.poolId,
      fighterId: arenaQueueEntries.fighterId,
      userId: arenaQueueEntries.userId,
      status: arenaQueueEntries.status,
      simulationId: arenaQueueEntries.simulationId,
      lockCorrelationId: arenaQueueEntries.lockCorrelationId,
      agentVersionId: arenaQueueEntries.agentVersionId,
      queuedAt: arenaQueueEntries.queuedAt,
      matchedAt: arenaQueueEntries.matchedAt,
    })
    .from(arenaQueueEntries)
    .where(
      and(
        eq(arenaQueueEntries.fighterId, fighterId),
        inArray(arenaQueueEntries.status, ["queued", "matched"]),
      ),
    )
    .orderBy(asc(arenaQueueEntries.queuedAt))
    .limit(1);

  return rows[0] ?? null;
};

export const setFighterArenaStatus = async (
  fighterId: number,
  status: "idle" | "queued" | "in_simulation" | "settling",
) => {
  await db
    .update(fighters)
    .set({ arenaStatus: status, updatedAt: new Date() })
    .where(eq(fighters.id, fighterId));
};

export const enqueueFighter = async ({
  poolId,
  fighterId,
  userId,
  lockCorrelationId,
  agentVersionId,
}: {
  poolId: string;
  fighterId: number;
  userId: string;
  lockCorrelationId: string;
  agentVersionId: string | null;
}) =>
  db.transaction(async (tx) => {
    const fighterRows = await tx
      .select({ arenaStatus: fighters.arenaStatus })
      .from(fighters)
      .where(and(eq(fighters.id, fighterId), eq(fighters.userId, userId)))
      .limit(1);
    if (!fighterRows[0]) {
      throw new Error("Fighter not found for this user.");
    }
    if (fighterRows[0].arenaStatus !== "idle") {
      throw new Error("Fighter is not available for arena queue.");
    }

    const inserted = await tx
      .insert(arenaQueueEntries)
      .values({
        poolId,
        fighterId,
        userId,
        status: "queued",
        lockCorrelationId,
        agentVersionId,
      })
      .returning({
        id: arenaQueueEntries.id,
        poolId: arenaQueueEntries.poolId,
        fighterId: arenaQueueEntries.fighterId,
        userId: arenaQueueEntries.userId,
        status: arenaQueueEntries.status,
        simulationId: arenaQueueEntries.simulationId,
        lockCorrelationId: arenaQueueEntries.lockCorrelationId,
        agentVersionId: arenaQueueEntries.agentVersionId,
        queuedAt: arenaQueueEntries.queuedAt,
        matchedAt: arenaQueueEntries.matchedAt,
      });

    const entry = inserted[0];
    if (!entry) {
      throw new Error("Failed to enqueue fighter.");
    }

    await tx
      .update(fighters)
      .set({ arenaStatus: "queued", updatedAt: new Date() })
      .where(eq(fighters.id, fighterId));

    return entry satisfies ArenaQueueEntryRecord;
  });

export const dequeueFighter = async ({
  fighterId,
  userId,
}: {
  fighterId: number;
  userId: string;
}) =>
  db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: arenaQueueEntries.id,
        poolId: arenaQueueEntries.poolId,
        lockCorrelationId: arenaQueueEntries.lockCorrelationId,
        status: arenaQueueEntries.status,
      })
      .from(arenaQueueEntries)
      .where(
        and(
          eq(arenaQueueEntries.fighterId, fighterId),
          eq(arenaQueueEntries.userId, userId),
          eq(arenaQueueEntries.status, "queued"),
        ),
      )
      .limit(1);

    const entry = rows[0];
    if (!entry) {
      throw new Error("No queued arena entry found for this fighter.");
    }

    const now = new Date();
    await tx
      .update(arenaQueueEntries)
      .set({ status: "cancelled", matchedAt: now })
      .where(eq(arenaQueueEntries.id, entry.id));

    await tx
      .update(fighters)
      .set({ arenaStatus: "idle", updatedAt: now })
      .where(eq(fighters.id, fighterId));

    return entry;
  });

export const matchQueueEntries = async ({
  entryIds,
  simulationId,
}: {
  entryIds: string[];
  simulationId: string;
}) => {
  if (entryIds.length === 0) {
    return;
  }
  const now = new Date();
  await db
    .update(arenaQueueEntries)
    .set({
      status: "matched",
      simulationId,
      matchedAt: now,
    })
    .where(inArray(arenaQueueEntries.id, entryIds));
};

export const listUserQueueEntries = async (userId: string) =>
  db
    .select({
      id: arenaQueueEntries.id,
      poolId: arenaQueueEntries.poolId,
      fighterId: arenaQueueEntries.fighterId,
      userId: arenaQueueEntries.userId,
      status: arenaQueueEntries.status,
      simulationId: arenaQueueEntries.simulationId,
      lockCorrelationId: arenaQueueEntries.lockCorrelationId,
      agentVersionId: arenaQueueEntries.agentVersionId,
      queuedAt: arenaQueueEntries.queuedAt,
      matchedAt: arenaQueueEntries.matchedAt,
      network: arenaPools.network,
      battleMode: arenaPools.battleMode,
      stakeAmountNative: arenaPools.stakeAmountNative,
      minFighters: arenaPools.minFighters,
      maxFighters: arenaPools.maxFighters,
      broadcastId: broadcasts.id,
      winnerFighterId: simulations.winnerFighterId,
      simulationStatus: simulations.status,
      fighterSlug: fighters.slug,
      fighterName: fighters.name,
    })
    .from(arenaQueueEntries)
    .innerJoin(arenaPools, eq(arenaQueueEntries.poolId, arenaPools.id))
    .innerJoin(fighters, eq(arenaQueueEntries.fighterId, fighters.id))
    .leftJoin(simulations, eq(arenaQueueEntries.simulationId, simulations.id))
    .leftJoin(broadcasts, eq(simulations.id, broadcasts.simulationId))
    .where(
      and(
        eq(arenaQueueEntries.userId, userId),
        inArray(arenaQueueEntries.status, ["queued", "matched"]),
      ),
    )
    .orderBy(asc(arenaQueueEntries.queuedAt));

export const listUserActiveArenaFighters = async (userId: string) =>
  db
    .select({
      id: fighters.id,
      slug: fighters.slug,
      name: fighters.name,
      arenaStatus: fighters.arenaStatus,
      poolId: arenaQueueEntries.poolId,
      simulationId: arenaQueueEntries.simulationId,
      battleMode: arenaPools.battleMode,
      stakeAmountNative: arenaPools.stakeAmountNative,
    })
    .from(fighters)
    .leftJoin(
      arenaQueueEntries,
      and(eq(arenaQueueEntries.fighterId, fighters.id), eq(arenaQueueEntries.status, "matched")),
    )
    .leftJoin(arenaPools, eq(arenaQueueEntries.poolId, arenaPools.id))
    .where(
      and(
        eq(fighters.userId, userId),
        inArray(fighters.arenaStatus, ["in_simulation", "settling"]),
      ),
    );

export const getQueueEntriesBySimulationId = async (simulationId: string) =>
  db
    .select({
      id: arenaQueueEntries.id,
      poolId: arenaQueueEntries.poolId,
      fighterId: arenaQueueEntries.fighterId,
      userId: arenaQueueEntries.userId,
      status: arenaQueueEntries.status,
      simulationId: arenaQueueEntries.simulationId,
      lockCorrelationId: arenaQueueEntries.lockCorrelationId,
      agentVersionId: arenaQueueEntries.agentVersionId,
      queuedAt: arenaQueueEntries.queuedAt,
      matchedAt: arenaQueueEntries.matchedAt,
    })
    .from(arenaQueueEntries)
    .where(eq(arenaQueueEntries.simulationId, simulationId));

export const getSimulationArenaPoolId = async (simulationId: string) => {
  const rows = await db
    .select({ arenaPoolId: simulations.arenaPoolId })
    .from(simulations)
    .where(eq(simulations.id, simulationId))
    .limit(1);
  return rows[0]?.arenaPoolId ?? null;
};
