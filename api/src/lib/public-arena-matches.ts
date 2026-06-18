import { arenaPools, broadcasts, db, desc, eq, simulations } from "@ijf/database";
import type { PublicArenaMatch } from "@ijf/shared";

import { listOpponentsBySimulationIds } from "./arena/pool-repository";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const parseLimit = (value: number | undefined): number => {
  if (value === undefined || !Number.isInteger(value) || value <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(value, MAX_LIMIT);
};

const normalizeFighterId = (value: number | string | null | undefined): number | null => {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const orderParticipantsWithWinnerFirst = (
  participants: PublicArenaMatch["participants"],
  winnerFighterId: number | null,
): PublicArenaMatch["participants"] => {
  const winnerId = normalizeFighterId(winnerFighterId);
  if (winnerId === null) {
    return participants;
  }

  const winner = participants.find(
    (participant) => normalizeFighterId(participant.fighterId) === winnerId,
  );
  if (!winner) {
    return participants;
  }

  return [
    winner,
    ...participants.filter((participant) => normalizeFighterId(participant.fighterId) !== winnerId),
  ];
};

export const listRecentPublicArenaMatches = async ({
  limit: requestedLimit,
}: {
  limit?: number;
} = {}): Promise<PublicArenaMatch[]> => {
  const limit = parseLimit(requestedLimit);

  const rows = await db
    .select({
      simulationId: simulations.id,
      broadcastId: broadcasts.id,
      network: arenaPools.network,
      battleMode: arenaPools.battleMode,
      stakeAmountNative: arenaPools.stakeAmountNative,
      matchedAt: simulations.startedAt,
      createdAt: simulations.createdAt,
      simulationStatus: simulations.status,
      winnerFighterId: simulations.winnerFighterId,
    })
    .from(simulations)
    .innerJoin(broadcasts, eq(simulations.id, broadcasts.simulationId))
    .innerJoin(arenaPools, eq(simulations.arenaPoolId, arenaPools.id))
    .orderBy(desc(simulations.createdAt))
    .limit(limit);

  if (rows.length === 0) {
    return [];
  }

  const simulationIds = rows.map((row) => row.simulationId);
  const participantsBySimId = await listOpponentsBySimulationIds(simulationIds);

  return rows.flatMap((row) => {
    const participants = participantsBySimId.get(row.simulationId) ?? [];
    if (participants.length === 0) {
      return [];
    }

    const stakeNative = BigInt(row.stakeAmountNative);
    const totalStakeAmountNative = (stakeNative * BigInt(participants.length)).toString();
    const matchedAt = (row.matchedAt ?? row.createdAt).toISOString();
    const orderedParticipants = orderParticipantsWithWinnerFirst(participants, row.winnerFighterId);

    return [
      {
        simulationId: row.simulationId,
        broadcastId: row.broadcastId,
        network: row.network as "sui",
        battleMode: row.battleMode,
        stakeAmountNative: row.stakeAmountNative,
        totalStakeAmountNative,
        matchedAt,
        simulationStatus: row.simulationStatus,
        winnerFighterId: row.winnerFighterId,
        participants: orderedParticipants,
      } satisfies PublicArenaMatch,
    ];
  });
};
