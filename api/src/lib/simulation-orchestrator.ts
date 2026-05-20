import { createHash } from "node:crypto";

import type { BroadcastMessage, ReplayFrame } from "@ijf/shared";
import { simulationManager } from "@ijf/simulator";

import { bindPipelineTenant, serializeClientPipelineState } from "./pipeline-runner";
import { fighterAgentScriptObjectKey, getObjectBuffer } from "./r2";
import { readReplayFramesArtifact, writeSimulationArtifacts } from "./simulation-artifacts";
import {
  createSimulationAndBroadcast,
  getBroadcastWithSimulationForUser,
  getSimulationWithBroadcastForUser,
  listSimulationParticipants,
  markSimulationEnded,
  markSimulationErrored,
  markSimulationRunning,
  markSimulationStartFailed,
} from "./simulation-repository";

type AgentSource = "r2" | "pipeline" | "fallback";

type ResolvedSimulationPlayer = {
  fighterId: number;
  id: string;
  code: string;
  source: AgentSource;
  objectKey: string | null;
  hash: string;
};

type ActiveSimulation = {
  simulationId: string;
  userId: string;
  broadcastId: string;
  messages: BroadcastMessage[];
  isFinalized: boolean;
};

const activeByBroadcastId = new Map<string, ActiveSimulation>();

const FALLBACK_AGENT_CODE = `
self.__agentExport = {
  init: () => {},
  act: () => ({ thrust: 0.2, turn: 0.05, climb: 0, shoot: false }),
  learn: () => {},
};
`;

const hashContent = (value: string) => createHash("sha256").update(value).digest("hex");

const resolvePlayerFromSources = async ({
  userId,
  fighterId,
  fighterKey,
}: {
  userId: string;
  fighterId: number;
  fighterKey: string;
}): Promise<ResolvedSimulationPlayer> => {
  const playerId = `jet-fighter-${fighterKey}`;
  const agentScriptKey = fighterAgentScriptObjectKey(userId, fighterId);
  const r2Script = await getObjectBuffer(agentScriptKey);
  if (r2Script) {
    const code = r2Script.toString("utf8");
    if (code.trim().length > 0) {
      return {
        fighterId,
        id: playerId,
        code,
        source: "r2",
        objectKey: agentScriptKey,
        hash: hashContent(code),
      };
    }
  }

  const snapshot = await serializeClientPipelineState(fighterKey);
  const pipelineCode = snapshot?.outputs?.["agent-code"]?.content;
  if (pipelineCode && pipelineCode.trim().length > 0) {
    return {
      fighterId,
      id: playerId,
      code: pipelineCode,
      source: "pipeline",
      objectKey: null,
      hash: hashContent(pipelineCode),
    };
  }

  return {
    fighterId,
    id: playerId,
    code: FALLBACK_AGENT_CODE,
    source: "fallback",
    objectKey: null,
    hash: hashContent(FALLBACK_AGENT_CODE),
  };
};

const appendMessage = (broadcastId: string, message: BroadcastMessage) => {
  const active = activeByBroadcastId.get(broadcastId);
  if (!active || active.isFinalized) {
    return;
  }
  active.messages.push(message);
};

const finalizeEndedSimulation = async ({
  simulationId,
  userId,
  broadcastId,
  winnerId,
  replayHashHex,
  frames,
}: {
  simulationId: string;
  userId: string;
  broadcastId: string;
  winnerId: string | null;
  replayHashHex: string;
  frames: ReplayFrame[];
}) => {
  const active = activeByBroadcastId.get(broadcastId);
  if (!active || active.isFinalized) {
    return;
  }
  active.isFinalized = true;

  const { replayObjectKey, broadcastEventsObjectKey } = await writeSimulationArtifacts({
    userId,
    simulationId,
    frames,
    messages: active.messages,
  });

  await markSimulationEnded({
    simulationId,
    broadcastId,
    winnerId,
    replayHashHex,
    replayFrameCount: frames.length,
    replayObjectKey,
    broadcastEventsObjectKey,
  });
  activeByBroadcastId.delete(broadcastId);
};

const finalizeErroredSimulation = async ({
  simulationId,
  userId,
  broadcastId,
  message,
}: {
  simulationId: string;
  userId: string;
  broadcastId: string;
  message: string;
}) => {
  const active = activeByBroadcastId.get(broadcastId);
  if (!active || active.isFinalized) {
    return;
  }
  active.isFinalized = true;

  const replayFrames = simulationManager.getReplay(broadcastId) ?? [];
  const artifacts = await writeSimulationArtifacts({
    userId,
    simulationId,
    frames: replayFrames,
    messages: active.messages,
  });

  await markSimulationErrored({
    simulationId,
    broadcastId,
    errorMessage: message,
    replayFrameCount: replayFrames.length,
    replayObjectKey: artifacts.replayObjectKey,
    broadcastEventsObjectKey: artifacts.broadcastEventsObjectKey,
  });
  activeByBroadcastId.delete(broadcastId);
};

export const startSimulationForRoster = async ({
  initiatorUserId,
  fighters,
  seed,
}: {
  initiatorUserId: string;
  fighters: Array<{ fighterId: number; fighterKey: string; ownerUserId: string }>;
  seed?: number;
}) => {
  if (fighters.length === 0) {
    throw new Error("At least one fighter is required to start a simulation.");
  }

  const resolvedSeed = Number.isFinite(seed) ? Number(seed) : Date.now();
  const broadcastId = `${fighters[0]!.fighterId}-${crypto.randomUUID()}`;
  const players = await Promise.all(
    fighters.map(async ({ fighterId, fighterKey, ownerUserId }) => {
      bindPipelineTenant(fighterKey, { userId: ownerUserId, fighterId });
      return resolvePlayerFromSources({ userId: ownerUserId, fighterId, fighterKey });
    }),
  );

  const created = await createSimulationAndBroadcast({
    userId: initiatorUserId,
    broadcastId,
    seed: resolvedSeed,
    participants: players.map((player, index) => ({
      fighterId: player.fighterId,
      playerSlot: index,
      playerId: player.id,
      agentSource: player.source,
      agentObjectKey: player.objectKey,
      agentHash: player.hash,
    })),
  });

  activeByBroadcastId.set(broadcastId, {
    simulationId: created.simulationId,
    userId: initiatorUserId,
    broadcastId,
    messages: [],
    isFinalized: false,
  });

  try {
    simulationManager.startSimulation({
      broadcastId,
      players: players.map((player) => ({ id: player.id, code: player.code })),
      seed: resolvedSeed,
      lifecycle: {
        onInit: async (init) => {
          appendMessage(broadcastId, { type: "init", data: init.data });
          await markSimulationRunning({
            simulationId: created.simulationId,
            broadcastId,
          });
        },
        onFrame: (frame) => {
          appendMessage(broadcastId, { type: "frame", data: frame.data });
        },
        onEnd: async (end) => {
          appendMessage(broadcastId, {
            type: "end",
            data: {
              winnerId: end.data.winnerId,
              replayHashHex: end.data.replayHashHex,
            },
          });
          await finalizeEndedSimulation({
            simulationId: created.simulationId,
            userId: initiatorUserId,
            broadcastId,
            winnerId: end.data.winnerId,
            replayHashHex: end.data.replayHashHex,
            frames: end.data.frames,
          });
        },
        onError: async (error) => {
          appendMessage(broadcastId, { type: "error", data: { message: error.data.message } });
          await finalizeErroredSimulation({
            simulationId: created.simulationId,
            userId: initiatorUserId,
            broadcastId,
            message: error.data.message,
          });
        },
      },
    });
  } catch (error) {
    activeByBroadcastId.delete(broadcastId);
    await markSimulationStartFailed({
      simulationId: created.simulationId,
      broadcastId,
      errorMessage:
        error instanceof Error ? error.message : "Simulation failed before runtime startup.",
    });
    throw error;
  }

  return {
    simulationId: created.simulationId,
    broadcastId,
    status: created.status,
  };
};

export const startSimulationForFighter = async ({
  userId,
  fighterId,
  fighterKey,
  seed,
}: {
  userId: string;
  fighterId: number;
  fighterKey: string;
  seed?: number;
}) =>
  startSimulationForRoster({
    initiatorUserId: userId,
    fighters: [{ fighterId, fighterKey, ownerUserId: userId }],
    seed,
  });

export const getSimulationStatusForBroadcast = async ({
  userId,
  broadcastId,
}: {
  userId: string;
  broadcastId: string;
}) => {
  const persisted = await getBroadcastWithSimulationForUser(userId, broadcastId);
  if (!persisted) {
    return null;
  }

  const inMemory = simulationManager.getSummary(broadcastId);
  return {
    simulationId: persisted.simulationId,
    broadcastId: persisted.broadcastId,
    status: inMemory?.status ?? persisted.simulationStatus,
    winnerId: inMemory?.winnerId ?? persisted.winnerId,
    startedAt: inMemory?.startedAt ?? persisted.simulationStartedAt?.getTime() ?? null,
    endedAt: inMemory?.endedAt ?? persisted.simulationEndedAt?.getTime() ?? null,
    replayHashHex: inMemory?.replayHashHex ?? persisted.replayHashHex,
    replayLength: inMemory?.replayLength ?? persisted.replayFrameCount,
    errorMessage: inMemory?.errorMessage ?? persisted.errorMessage,
  };
};

export const getReplayForBroadcast = async ({
  userId,
  broadcastId,
}: {
  userId: string;
  broadcastId: string;
}) => {
  const persisted = await getBroadcastWithSimulationForUser(userId, broadcastId);
  if (!persisted) {
    return null;
  }

  const inMemory = simulationManager.getReplay(broadcastId);
  if (inMemory) {
    return { frames: inMemory };
  }

  if (!persisted.replayObjectKey) {
    return null;
  }

  const frames = await readReplayFramesArtifact(persisted.replayObjectKey);
  if (!frames) {
    return null;
  }

  return { frames };
};

export const getBroadcastDetails = async ({
  userId,
  broadcastId,
}: {
  userId: string;
  broadcastId: string;
}) => {
  const persisted = await getBroadcastWithSimulationForUser(userId, broadcastId);
  if (!persisted) {
    return null;
  }

  return {
    broadcastId: persisted.broadcastId,
    status: persisted.broadcastStatus,
    startedAt: persisted.broadcastStartedAt?.toISOString() ?? null,
    endedAt: persisted.broadcastEndedAt?.toISOString() ?? null,
    lastEventAt: persisted.broadcastLastEventAt?.toISOString() ?? null,
    simulation: {
      id: persisted.simulationId,
      status: persisted.simulationStatus,
      startedAt: persisted.simulationStartedAt?.toISOString() ?? null,
      endedAt: persisted.simulationEndedAt?.toISOString() ?? null,
      replayHashHex: persisted.replayHashHex,
      replayFrameCount: persisted.replayFrameCount,
      winnerId: persisted.winnerId,
      errorMessage: persisted.errorMessage,
    },
  };
};

export const getSimulationDetails = async ({
  userId,
  simulationId,
}: {
  userId: string;
  simulationId: string;
}) => {
  const persisted = await getSimulationWithBroadcastForUser(userId, simulationId);
  if (!persisted) {
    return null;
  }

  const participants = await listSimulationParticipants(simulationId);
  return {
    simulationId: persisted.simulationId,
    status: persisted.simulationStatus,
    startedAt: persisted.simulationStartedAt?.toISOString() ?? null,
    endedAt: persisted.simulationEndedAt?.toISOString() ?? null,
    winnerId: persisted.winnerId,
    replayHashHex: persisted.replayHashHex,
    replayFrameCount: persisted.replayFrameCount,
    broadcastEventsObjectKey: persisted.broadcastEventsObjectKey,
    replayObjectKey: persisted.replayObjectKey,
    errorMessage: persisted.errorMessage,
    broadcast: {
      id: persisted.broadcastId,
      status: persisted.broadcastStatus,
      startedAt: persisted.broadcastStartedAt?.toISOString() ?? null,
      endedAt: persisted.broadcastEndedAt?.toISOString() ?? null,
      lastEventAt: persisted.broadcastLastEventAt?.toISOString() ?? null,
    },
    participants,
  };
};
