import { and, broadcasts, db, eq, simulationParticipants, simulations } from "@ijf/database";

type SimulationStatus = "queued" | "running" | "ended" | "error";
type AgentSource = "r2" | "pipeline" | "fallback";

export type CreateSimulationParticipantInput = {
  fighterId: number;
  playerSlot: number;
  playerId: string;
  agentSource: AgentSource;
  agentObjectKey?: string | null;
  agentHash?: string | null;
  agentVersionId?: string | null;
  checkpointHash?: string | null;
};

export const createSimulationAndBroadcast = async ({
  userId,
  broadcastId,
  seed,
  participants,
  arenaPoolId,
}: {
  userId: string;
  broadcastId: string;
  seed: number;
  participants: CreateSimulationParticipantInput[];
  arenaPoolId?: string | null;
}) => {
  const simulationRows = await db
    .insert(simulations)
    .values({
      userId,
      seed,
      status: "queued",
      arenaPoolId: arenaPoolId ?? null,
    })
    .returning({
      id: simulations.id,
      status: simulations.status,
    });

  const simulation = simulationRows[0];
  if (!simulation) {
    throw new Error("Failed to create simulation record.");
  }

  try {
    await db.insert(broadcasts).values({
      id: broadcastId,
      simulationId: simulation.id,
      userId,
      status: simulation.status,
      lastEventAt: new Date(),
    });

    if (participants.length > 0) {
      await db.insert(simulationParticipants).values(
        participants.map((participant) => ({
          simulationId: simulation.id,
          fighterId: participant.fighterId,
          playerSlot: participant.playerSlot,
          playerId: participant.playerId,
          agentSource: participant.agentSource,
          agentObjectKey: participant.agentObjectKey ?? null,
          agentHash: participant.agentHash ?? null,
          agentVersionId: participant.agentVersionId ?? null,
          checkpointHash: participant.checkpointHash ?? null,
        })),
      );
    }
  } catch (error) {
    // Best-effort cleanup when downstream inserts fail without transaction support.
    await db.delete(simulations).where(eq(simulations.id, simulation.id));
    throw error;
  }

  return {
    simulationId: simulation.id,
    status: simulation.status,
    broadcastId,
  };
};

export const markSimulationRunning = async ({
  simulationId,
  broadcastId,
}: {
  simulationId: string;
  broadcastId: string;
}) => {
  const now = new Date();
  await db
    .update(simulations)
    .set({
      status: "running",
      startedAt: now,
      updatedAt: now,
    })
    .where(eq(simulations.id, simulationId));

  await db
    .update(broadcasts)
    .set({
      status: "running",
      startedAt: now,
      lastEventAt: now,
      updatedAt: now,
    })
    .where(eq(broadcasts.id, broadcastId));
};

export const markSimulationEnded = async ({
  simulationId,
  broadcastId,
  winnerId,
  winnerFighterId,
  replayHashHex,
  replayFrameCount,
  replayObjectKey,
  broadcastEventsObjectKey,
}: {
  simulationId: string;
  broadcastId: string;
  winnerId: string | null;
  winnerFighterId: number | null;
  replayHashHex: string;
  replayFrameCount: number;
  replayObjectKey: string;
  broadcastEventsObjectKey: string;
}) => {
  const now = new Date();
  await db
    .update(simulations)
    .set({
      status: "ended",
      winnerId,
      winnerFighterId,
      replayHashHex,
      replayFrameCount,
      replayObjectKey,
      broadcastEventsObjectKey,
      endedAt: now,
      updatedAt: now,
    })
    .where(eq(simulations.id, simulationId));

  await db
    .update(broadcasts)
    .set({
      status: "ended",
      endedAt: now,
      lastEventAt: now,
      updatedAt: now,
    })
    .where(eq(broadcasts.id, broadcastId));
};

export const markSimulationErrored = async ({
  simulationId,
  broadcastId,
  errorMessage,
  replayFrameCount,
  replayObjectKey,
  broadcastEventsObjectKey,
}: {
  simulationId: string;
  broadcastId: string;
  errorMessage: string;
  replayFrameCount: number;
  replayObjectKey: string | null;
  broadcastEventsObjectKey: string | null;
}) => {
  const now = new Date();
  await db
    .update(simulations)
    .set({
      status: "error",
      errorMessage,
      replayFrameCount,
      replayObjectKey,
      broadcastEventsObjectKey,
      endedAt: now,
      updatedAt: now,
    })
    .where(eq(simulations.id, simulationId));

  await db
    .update(broadcasts)
    .set({
      status: "error",
      endedAt: now,
      lastEventAt: now,
      updatedAt: now,
    })
    .where(eq(broadcasts.id, broadcastId));
};

export const markSimulationStartFailed = async ({
  simulationId,
  broadcastId,
  errorMessage,
}: {
  simulationId: string;
  broadcastId: string;
  errorMessage: string;
}) =>
  markSimulationErrored({
    simulationId,
    broadcastId,
    errorMessage,
    replayFrameCount: 0,
    replayObjectKey: null,
    broadcastEventsObjectKey: null,
  });

export type BroadcastWithSimulation = {
  broadcastId: string;
  broadcastStatus: SimulationStatus;
  broadcastStartedAt: Date | null;
  broadcastEndedAt: Date | null;
  broadcastLastEventAt: Date | null;
  simulationId: string;
  simulationStatus: SimulationStatus;
  simulationStartedAt: Date | null;
  simulationEndedAt: Date | null;
  replayHashHex: string | null;
  replayFrameCount: number;
  replayObjectKey: string | null;
  broadcastEventsObjectKey: string | null;
  winnerId: string | null;
  winnerFighterId: number | null;
  errorMessage: string | null;
};

export const getBroadcastWithSimulationForUser = async (
  userId: string,
  broadcastId: string,
): Promise<BroadcastWithSimulation | null> => {
  const rows = await db
    .select({
      broadcastId: broadcasts.id,
      broadcastStatus: broadcasts.status,
      broadcastStartedAt: broadcasts.startedAt,
      broadcastEndedAt: broadcasts.endedAt,
      broadcastLastEventAt: broadcasts.lastEventAt,
      simulationId: simulations.id,
      simulationStatus: simulations.status,
      simulationStartedAt: simulations.startedAt,
      simulationEndedAt: simulations.endedAt,
      replayHashHex: simulations.replayHashHex,
      replayFrameCount: simulations.replayFrameCount,
      replayObjectKey: simulations.replayObjectKey,
      broadcastEventsObjectKey: simulations.broadcastEventsObjectKey,
      winnerId: simulations.winnerId,
      winnerFighterId: simulations.winnerFighterId,
      errorMessage: simulations.errorMessage,
    })
    .from(broadcasts)
    .innerJoin(simulations, eq(broadcasts.simulationId, simulations.id))
    .where(and(eq(broadcasts.userId, userId), eq(broadcasts.id, broadcastId)))
    .limit(1);

  return rows[0] ?? null;
};

export type SimulationWithBroadcast = BroadcastWithSimulation & {
  userId: string;
};

export const getSimulationWithBroadcastForUser = async (
  userId: string,
  simulationId: string,
): Promise<SimulationWithBroadcast | null> => {
  const rows = await db
    .select({
      userId: simulations.userId,
      broadcastId: broadcasts.id,
      broadcastStatus: broadcasts.status,
      broadcastStartedAt: broadcasts.startedAt,
      broadcastEndedAt: broadcasts.endedAt,
      broadcastLastEventAt: broadcasts.lastEventAt,
      simulationId: simulations.id,
      simulationStatus: simulations.status,
      simulationStartedAt: simulations.startedAt,
      simulationEndedAt: simulations.endedAt,
      replayHashHex: simulations.replayHashHex,
      replayFrameCount: simulations.replayFrameCount,
      replayObjectKey: simulations.replayObjectKey,
      broadcastEventsObjectKey: simulations.broadcastEventsObjectKey,
      winnerId: simulations.winnerId,
      winnerFighterId: simulations.winnerFighterId,
      errorMessage: simulations.errorMessage,
    })
    .from(simulations)
    .innerJoin(broadcasts, eq(broadcasts.simulationId, simulations.id))
    .where(and(eq(simulations.userId, userId), eq(simulations.id, simulationId)))
    .limit(1);

  return rows[0] ?? null;
};

export const listSimulationParticipants = async (simulationId: string) =>
  db
    .select({
      fighterId: simulationParticipants.fighterId,
      playerSlot: simulationParticipants.playerSlot,
      playerId: simulationParticipants.playerId,
      agentSource: simulationParticipants.agentSource,
      agentObjectKey: simulationParticipants.agentObjectKey,
      agentHash: simulationParticipants.agentHash,
      agentVersionId: simulationParticipants.agentVersionId,
      checkpointHash: simulationParticipants.checkpointHash,
    })
    .from(simulationParticipants)
    .where(eq(simulationParticipants.simulationId, simulationId));
