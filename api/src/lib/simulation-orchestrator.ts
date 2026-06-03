import { createHash } from "node:crypto";

import {
  type BroadcastMessage,
  formatFighterDisplayLabel,
  type ReplayFrame,
  resolveFighterName,
  type SpritesheetManifest,
} from "@ijf/shared";
import { simulationManager } from "@ijf/simulator";

import {
  getFighterAgentVersionByIdForOwnerAndFighter,
  getLatestFighterAgentVersionForHash,
} from "./agent-version-repository";
import {
  bindPipelineTenant,
  type ClientPipelineStateSnapshot,
  serializeClientPipelineState,
} from "./pipeline-runner";
import {
  fighterAgentScriptObjectKey,
  getObjectBuffer,
  getSignedReadUrl,
  spritesheetImageObjectKey,
  spritesheetManifestObjectKey,
  strikecraftSpriteObjectKey,
} from "./r2";
import {
  readBroadcastInitArtifact,
  readReplayFramesArtifact,
  writeSimulationArtifacts,
} from "./simulation-artifacts";
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
  ownerUserId: string;
  id: string;
  code: string;
  source: AgentSource;
  objectKey: string | null;
  hash: string;
  agentVersionId: string | null;
  agentVersionNumber: number | null;
};

type ActiveSimulation = {
  simulationId: string;
  userId: string;
  broadcastId: string;
  messages: BroadcastMessage[];
  isFinalized: boolean;
};

export class SimulationStartInputError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "SimulationStartInputError";
    this.statusCode = statusCode;
  }
}

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
  playerId,
  requestedAgentVersionId,
  pipelineSnapshot,
}: {
  userId: string;
  fighterId: number;
  fighterKey: string;
  playerId: string;
  requestedAgentVersionId?: string | null;
  pipelineSnapshot?: ClientPipelineStateSnapshot | null;
}): Promise<ResolvedSimulationPlayer> => {
  if (requestedAgentVersionId) {
    const selectedVersion = await getFighterAgentVersionByIdForOwnerAndFighter({
      id: requestedAgentVersionId,
      fighterId,
      userId,
    });
    if (!selectedVersion) {
      throw new SimulationStartInputError(
        `Selected agent version is invalid for fighter ${fighterId}.`,
      );
    }

    const versionBuffer = await getObjectBuffer(selectedVersion.objectKey);
    if (!versionBuffer) {
      throw new SimulationStartInputError(
        `Selected agent version artifact is missing for fighter ${fighterId}.`,
      );
    }

    const versionCode = versionBuffer.toString("utf8");
    if (versionCode.trim().length === 0) {
      throw new SimulationStartInputError(
        `Selected agent version is empty for fighter ${fighterId}.`,
      );
    }

    return {
      fighterId,
      ownerUserId: userId,
      id: playerId,
      code: versionCode,
      source: "pipeline",
      objectKey: selectedVersion.objectKey,
      hash: hashContent(versionCode),
      agentVersionId: selectedVersion.id,
      agentVersionNumber: selectedVersion.versionNumber,
    };
  }

  const agentScriptKey = fighterAgentScriptObjectKey(userId, fighterId);
  const r2Script = await getObjectBuffer(agentScriptKey);
  if (r2Script) {
    const code = r2Script.toString("utf8");
    if (code.trim().length > 0) {
      return {
        fighterId,
        ownerUserId: userId,
        id: playerId,
        code,
        source: "r2",
        objectKey: agentScriptKey,
        hash: hashContent(code),
        agentVersionId: null,
        agentVersionNumber: null,
      };
    }
  }

  const snapshot = pipelineSnapshot ?? (await serializeClientPipelineState(fighterKey));
  const pipelineCode = snapshot?.outputs?.["agent-code"]?.content;
  if (pipelineCode && pipelineCode.trim().length > 0) {
    const contentHash = hashContent(pipelineCode);
    const latestVersion = await getLatestFighterAgentVersionForHash({
      fighterId,
      contentHash,
    });
    return {
      fighterId,
      ownerUserId: userId,
      id: playerId,
      code: pipelineCode,
      source: "pipeline",
      objectKey: null,
      hash: contentHash,
      agentVersionId: latestVersion?.id ?? null,
      agentVersionNumber: latestVersion?.versionNumber ?? null,
    };
  }

  return {
    fighterId,
    ownerUserId: userId,
    id: playerId,
    code: FALLBACK_AGENT_CODE,
    source: "fallback",
    objectKey: null,
    hash: hashContent(FALLBACK_AGENT_CODE),
    agentVersionId: null,
    agentVersionNumber: null,
  };
};

const appendMessage = (broadcastId: string, message: BroadcastMessage) => {
  const active = activeByBroadcastId.get(broadcastId);
  if (!active || active.isFinalized) {
    return;
  }
  active.messages.push(message);
};

const getPlayerSpritesheetMeta = async (
  ownerUserId: string,
  fighterId: number,
  fighterName: string | null,
  agentVersionNumber: number | null,
): Promise<{
  fighterId: number;
  fighterName: string;
  agentVersionNumber: number | null;
  displayLabel: string | null;
  spritesheetImageUrl: string | null;
  spritesheetManifestUrl: string | null;
  spritesheetManifest: SpritesheetManifest | null;
  strikecraftTopSpriteUrl: string | null;
}> => {
  const imageKey = spritesheetImageObjectKey(ownerUserId, fighterId, "png");
  const manifestKey = spritesheetManifestObjectKey(ownerUserId, fighterId);
  const strikecraftTopSpriteKey = strikecraftSpriteObjectKey(ownerUserId, fighterId, "png");
  const [
    spritesheetImageUrl,
    spritesheetManifestUrl,
    spritesheetManifestRaw,
    strikecraftTopSpriteUrl,
  ] = await Promise.all([
    getSignedReadUrl(imageKey, 3600).catch(() => null),
    getSignedReadUrl(manifestKey, 3600).catch(() => null),
    getObjectBuffer(manifestKey).catch(() => null),
    getSignedReadUrl(strikecraftTopSpriteKey, 3600).catch(() => null),
  ]);
  let spritesheetManifest: SpritesheetManifest | null = null;
  if (spritesheetManifestRaw) {
    try {
      spritesheetManifest = JSON.parse(
        spritesheetManifestRaw.toString("utf8"),
      ) as SpritesheetManifest;
    } catch {
      spritesheetManifest = null;
    }
  }
  return {
    fighterId,
    fighterName: fighterName ?? `Fighter ${fighterId}`,
    agentVersionNumber,
    displayLabel:
      fighterName !== null
        ? formatFighterDisplayLabel({
            fighterName,
            fighterId,
            agentVersionNumber,
          })
        : null,
    spritesheetImageUrl,
    spritesheetManifestUrl,
    spritesheetManifest,
    strikecraftTopSpriteUrl,
  };
};

const finalizeEndedSimulation = async ({
  simulationId,
  userId,
  broadcastId,
  winnerId,
  winnerFighterId,
  replayHashHex,
  frames,
}: {
  simulationId: string;
  userId: string;
  broadcastId: string;
  winnerId: string | null;
  winnerFighterId: number | null;
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
    winnerFighterId,
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
  fighters: Array<{
    fighterId: number;
    fighterKey: string;
    fighterName: string | null;
    fighterSlug: string;
    ownerUserId: string;
    agentVersionId?: string | null;
  }>;
  seed?: number;
}) => {
  if (fighters.length === 0) {
    throw new Error("At least one fighter is required to start a simulation.");
  }

  const resolvedSeed = Number.isFinite(seed) ? Number(seed) : Date.now();
  const broadcastId = `${fighters[0]!.fighterId}-${crypto.randomUUID()}`;
  const players = await Promise.all(
    fighters.map(
      async (
        { fighterId, fighterKey, fighterName, fighterSlug, ownerUserId, agentVersionId },
        index,
      ) => {
        bindPipelineTenant(fighterKey, { userId: ownerUserId, fighterId });
        const pipelineSnapshot = await serializeClientPipelineState(fighterKey);
        const characterDescription =
          pipelineSnapshot?.outputs?.["character-description"]?.content ?? null;
        const resolvedFighterName = resolveFighterName({
          storedName: fighterName,
          characterDescription,
          slug: fighterSlug,
        });
        const player = await resolvePlayerFromSources({
          userId: ownerUserId,
          fighterId,
          fighterKey,
          playerId: `jet-fighter-${fighterKey}-slot-${index}`,
          requestedAgentVersionId: agentVersionId ?? null,
          pipelineSnapshot,
        });
        return {
          ...player,
          fighterName: resolvedFighterName,
        };
      },
    ),
  );

  const playerMetaEntries = await Promise.all(
    players.map(async (player) => [
      player.id,
      await getPlayerSpritesheetMeta(
        player.ownerUserId,
        player.fighterId,
        player.fighterName,
        player.agentVersionNumber,
      ),
    ]),
  );
  const playerMetaById = Object.fromEntries(playerMetaEntries);

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
      agentVersionId: player.agentVersionId,
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
      players: players.map((player) => ({
        id: player.id,
        code: player.code,
        fighterId: player.fighterId,
      })),
      playerMetaById,
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
              winnerFighterId: end.data.winnerFighterId,
              replayHashHex: end.data.replayHashHex,
            },
          });
          await finalizeEndedSimulation({
            simulationId: created.simulationId,
            userId: initiatorUserId,
            broadcastId,
            winnerId: end.data.winnerId,
            winnerFighterId: end.data.winnerFighterId,
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
    fighters: [
      {
        fighterId,
        fighterKey,
        fighterName: null,
        fighterSlug: String(fighterId),
        ownerUserId: userId,
      },
    ],
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
    winnerFighterId: inMemory?.winnerFighterId ?? persisted.winnerFighterId,
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

  const participants = await listSimulationParticipants(persisted.simulationId);
  const playerMetaById = Object.fromEntries(
    await Promise.all(
      participants.map(async (participant) => [
        participant.playerId,
        await getPlayerSpritesheetMeta(userId, participant.fighterId, null, null),
      ]),
    ),
  );
  const getInitFromActiveMessages = () => {
    const active = activeByBroadcastId.get(broadcastId);
    if (!active) {
      return null;
    }
    const initMessage = active.messages.find((message) => message.type === "init");
    return initMessage?.type === "init" ? initMessage.data : null;
  };

  const inMemory = simulationManager.getReplay(broadcastId);
  if (inMemory) {
    return { frames: inMemory, playerMetaById, initData: getInitFromActiveMessages() };
  }

  if (!persisted.replayObjectKey) {
    return null;
  }

  const frames = await readReplayFramesArtifact(persisted.replayObjectKey);
  if (!frames) {
    return null;
  }

  const initData = persisted.broadcastEventsObjectKey
    ? await readBroadcastInitArtifact(persisted.broadcastEventsObjectKey)
    : null;
  return { frames, playerMetaById, initData };
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
      winnerFighterId: persisted.winnerFighterId,
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
    winnerFighterId: persisted.winnerFighterId,
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
