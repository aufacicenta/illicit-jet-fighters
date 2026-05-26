import { z } from "zod";

const simulationStatusSchema = z.enum(["queued", "running", "ended", "error"]);
const agentSourceSchema = z.enum(["r2", "pipeline", "fallback"]);

export const simulationParticipantRequestSchema = z.object({
  fighterId: z.number().int().positive(),
  agentVersionId: z.string().uuid().nullable().optional(),
});

export const simulationStartRequestSchema = z.object({
  participants: z.array(simulationParticipantRequestSchema).optional(),
  fighterId: z.number().int().positive().optional(),
  fighterIds: z.array(z.number().int().positive()).optional(),
  seed: z.number().int().optional(),
});

export const simulationStartResponseSchema = z.object({
  simulationId: z.string().min(1),
  broadcastId: z.string().min(1),
  status: simulationStatusSchema,
});

export const simulationListItemSchema = z.object({
  simulationId: z.string().min(1),
  broadcastId: z.string().min(1),
  status: simulationStatusSchema,
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  winnerId: z.string().nullable(),
  replayFrameCount: z.number().int().nonnegative(),
  errorMessage: z.string().nullable(),
});

export const simulationListResponseSchema = z.object({
  simulations: z.array(simulationListItemSchema),
});

export const simulationStatusSnapshotSchema = z.object({
  simulationId: z.string().min(1),
  broadcastId: z.string().min(1),
  status: simulationStatusSchema,
  winnerId: z.string().nullable(),
  startedAt: z.number().int().nullable(),
  endedAt: z.number().int().nullable(),
  replayHashHex: z.string().nullable(),
  replayLength: z.number().int().nonnegative(),
  errorMessage: z.string().nullable(),
});

export const simulationReplayJetSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  altitude: z.number(),
  vx: z.number(),
  vy: z.number(),
  vAlt: z.number(),
  angle: z.number(),
  health: z.number(),
  ammo: z.number(),
  fuel: z.number(),
  weight: z.number(),
  cooldown: z.number(),
  collisionCount: z.number(),
  collisionDamageTaken: z.number(),
  lastCollision: z.unknown().nullable(),
  enemyHitsLanded: z.number(),
  enemyHitsTaken: z.number(),
  lastHitDealtToId: z.string().nullable(),
  lastHitTakenFromId: z.string().nullable(),
  lastHitDealtTick: z.number().nullable(),
  lastHitTakenTick: z.number().nullable(),
  pickupsCollected: z.record(z.string(), z.number()),
  alive: z.boolean(),
  fighterId: z.number().int().positive().nullable().optional(),
});

export const simulationReplayFrameSchema = z.object({
  tick: z.number().int().nonnegative(),
  jets: z.array(simulationReplayJetSchema),
  bullets: z.array(z.unknown()),
  hitEvents: z.array(z.unknown()),
  pickups: z.array(z.unknown()),
});

export const simulationPlayerMetaSchema = z.object({
  fighterId: z.number().int().positive(),
  fighterName: z.string(),
  agentVersionNumber: z.number().int().positive().nullable(),
  displayLabel: z.string().nullable(),
  spritesheetImageUrl: z.string().url().nullable(),
  spritesheetManifestUrl: z.string().url().nullable(),
  spritesheetManifest: z.unknown().nullable(),
  strikecraftTopSpriteUrl: z.string().url().nullable(),
});

export const simulationReplaySnapshotSchema = z.object({
  frames: z.array(simulationReplayFrameSchema),
  playerMetaById: z.record(z.string(), simulationPlayerMetaSchema),
  initData: z.unknown().nullable(),
});

export const simulationDetailsParticipantSchema = z.object({
  fighterId: z.number().int().positive(),
  playerSlot: z.number().int().nonnegative(),
  playerId: z.string().min(1),
  agentSource: agentSourceSchema,
  agentObjectKey: z.string().nullable(),
  agentHash: z.string().nullable(),
  agentVersionId: z.string().uuid().nullable(),
});

export const simulationDetailsSchema = z.object({
  simulationId: z.string().min(1),
  status: simulationStatusSchema,
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  winnerId: z.string().nullable(),
  replayHashHex: z.string().nullable(),
  replayFrameCount: z.number().int().nonnegative(),
  broadcastEventsObjectKey: z.string().nullable(),
  replayObjectKey: z.string().nullable(),
  errorMessage: z.string().nullable(),
  broadcast: z.object({
    id: z.string().min(1),
    status: simulationStatusSchema,
    startedAt: z.string().datetime().nullable(),
    endedAt: z.string().datetime().nullable(),
    lastEventAt: z.string().datetime().nullable(),
  }),
  participants: z.array(simulationDetailsParticipantSchema),
});

export const broadcastDetailsSnapshotSchema = z.object({
  broadcastId: z.string().min(1),
  status: simulationStatusSchema,
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  lastEventAt: z.string().datetime().nullable(),
  simulation: z.object({
    id: z.string().min(1),
    status: simulationStatusSchema,
    startedAt: z.string().datetime().nullable(),
    endedAt: z.string().datetime().nullable(),
    replayHashHex: z.string().nullable(),
    replayFrameCount: z.number().int().nonnegative(),
    winnerId: z.string().nullable(),
    errorMessage: z.string().nullable(),
  }),
});
