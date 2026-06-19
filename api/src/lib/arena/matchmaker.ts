import type { ArenaBattleMode } from "@ijf/database";

import {
  getFighterAgentVersionByIdForOwnerAndFighter,
  getLatestFighterAgentVersion,
} from "../agent-version-repository";
import { fighterKeyFromId, getFightersByIds, getOwnedFighter } from "../fighter-access";
import { startSimulationForRoster } from "../simulation-orchestrator";
import {
  getFighterAvailableBalanceNative,
  lockFighterStake,
  unlockFighterStake,
} from "./balance-lock";
import {
  type ArenaQueueEntryRecord,
  dequeueFighter,
  enqueueFighter,
  getPoolById,
  getQueuedEntriesForPool,
  matchQueueEntries,
  setFighterArenaStatus,
} from "./pool-repository";

const isSquadBattleMode = (battleMode: ArenaBattleMode) =>
  battleMode === "squad_4" || battleMode === "squad_8";

const selectEntriesForMatch = (
  queued: ArenaQueueEntryRecord[],
  minFighters: number,
  battleMode: ArenaBattleMode,
): ArenaQueueEntryRecord[] => {
  const selected: ArenaQueueEntryRecord[] = [];
  const enforceOneFighterPerUser = !isSquadBattleMode(battleMode);
  const seenUserIds = new Set<string>();

  for (const entry of queued) {
    if (enforceOneFighterPerUser && seenUserIds.has(entry.userId)) {
      continue;
    }
    if (enforceOneFighterPerUser) {
      seenUserIds.add(entry.userId);
    }
    selected.push(entry);
    if (selected.length >= minFighters) {
      break;
    }
  }

  return selected.length >= minFighters ? selected : [];
};

export const tryMatchPool = async (poolId: string) => {
  const pool = await getPoolById(poolId);
  if (!pool || !pool.isActive) {
    return null;
  }

  const queued = await getQueuedEntriesForPool(poolId);
  const selected = selectEntriesForMatch(queued, pool.minFighters, pool.battleMode);
  if (selected.length < pool.minFighters) {
    return null;
  }

  const fighterRecords = await getFightersByIds(selected.map((entry) => entry.fighterId));
  const fighterById = new Map(fighterRecords.map((fighter) => [fighter.id, fighter]));

  const roster = selected.map((entry) => {
    const fighter = fighterById.get(entry.fighterId);
    if (!fighter) {
      throw new Error(`Fighter ${entry.fighterId} was not found for arena match.`);
    }
    return {
      fighterId: fighter.id,
      fighterKey: fighterKeyFromId(fighter.id),
      fighterName: fighter.name,
      fighterSlug: fighter.slug,
      ownerUserId: fighter.userId,
      agentVersionId: entry.agentVersionId,
    };
  });

  const initiatorUserId = selected[0]!.userId;
  const summary = await startSimulationForRoster({
    initiatorUserId,
    fighters: roster,
    arenaPoolId: poolId,
  });

  await matchQueueEntries({
    entryIds: selected.map((entry) => entry.id),
    simulationId: summary.simulationId,
  });

  await Promise.all(
    selected.map((entry) => setFighterArenaStatus(entry.fighterId, "in_simulation")),
  );

  return {
    simulationId: summary.simulationId,
    broadcastId: summary.broadcastId,
    matchedFighterIds: selected.map((entry) => entry.fighterId),
  };
};

export const enterFighterInArenaPool = async ({
  poolId,
  fighterId,
  userId,
  agentVersionId: requestedAgentVersionId,
}: {
  poolId: string;
  fighterId: number;
  userId: string;
  agentVersionId?: string;
}) => {
  const pool = await getPoolById(poolId);
  if (!pool || !pool.isActive) {
    throw new Error("Arena pool is not available.");
  }

  const ownedFighter = await getOwnedFighter(fighterId, userId);
  if (!ownedFighter) {
    throw new Error("Fighter not found for this user.");
  }

  let resolvedAgentVersionId: string;
  if (requestedAgentVersionId) {
    const selectedVersion = await getFighterAgentVersionByIdForOwnerAndFighter({
      id: requestedAgentVersionId,
      fighterId,
      userId,
    });
    if (!selectedVersion) {
      throw new Error("Selected agent version is invalid for this fighter.");
    }
    resolvedAgentVersionId = selectedVersion.id;
  } else {
    const latestVersion = await getLatestFighterAgentVersion(fighterId);
    if (!latestVersion) {
      throw new Error("Fighter has no agent version available for arena entry.");
    }
    resolvedAgentVersionId = latestVersion.id;
  }

  const stakeAmountNative = BigInt(pool.stakeAmountNative);
  const available = await getFighterAvailableBalanceNative(fighterId);
  if (available < stakeAmountNative) {
    throw new Error("Insufficient fighter balance for this pool stake.");
  }

  const { correlationId } = await lockFighterStake({
    fighterId,
    amountNative: stakeAmountNative,
    poolId,
  });

  let entry;
  try {
    entry = await enqueueFighter({
      poolId,
      fighterId,
      userId,
      lockCorrelationId: correlationId,
      agentVersionId: resolvedAgentVersionId,
    });
  } catch (error) {
    await unlockFighterStake({
      fighterId,
      amountNative: stakeAmountNative,
      correlationId,
      poolId,
      reason: "cancelled",
    });
    throw error;
  }

  const match = await tryMatchPool(poolId);
  return { entry, match };
};

export const leaveArenaPool = async ({
  poolId,
  fighterId,
  userId,
}: {
  poolId: string;
  fighterId: number;
  userId: string;
}) => {
  const pool = await getPoolById(poolId);
  if (!pool) {
    throw new Error("Arena pool was not found.");
  }

  const cancelled = await dequeueFighter({ poolId, fighterId, userId });
  const stakeAmountNative = BigInt(pool.stakeAmountNative);

  if (cancelled.lockCorrelationId) {
    await unlockFighterStake({
      fighterId,
      amountNative: stakeAmountNative,
      correlationId: cancelled.lockCorrelationId,
      poolId,
      reason: "cancelled",
    });
  }

  return { cancelled: true };
};
