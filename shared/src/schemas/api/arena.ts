import { z } from "zod";

import { WALLET_NETWORK_NAMES } from "../../wallet-currency";

export const arenaBattleModeSchema = z.enum(["1v1", "squad_4", "squad_8", "world_war"]);

export const fighterArenaStatusSchema = z.enum(["idle", "queued", "in_simulation", "settling"]);

export const arenaQueueStatusSchema = z.enum(["queued", "matched", "cancelled"]);

export const arenaQueueEntrySchema = z.object({
  id: z.string().uuid(),
  poolId: z.string().uuid(),
  fighterId: z.number().int().positive(),
  userId: z.string().uuid(),
  status: arenaQueueStatusSchema,
  simulationId: z.string().uuid().nullable(),
  lockCorrelationId: z.string().nullable(),
  agentVersionId: z.string().uuid().nullable(),
  queuedAt: z.string().datetime(),
  matchedAt: z.string().datetime().nullable(),
});

export const arenaPoolSchema = z.object({
  id: z.string().uuid(),
  network: z.enum(WALLET_NETWORK_NAMES),
  battleMode: arenaBattleModeSchema,
  stakeAmountNative: z.string(),
  minFighters: z.number().int().positive(),
  maxFighters: z.number().int().positive(),
  isActive: z.boolean(),
  queuedCount: z.number().int().nonnegative(),
});

export const arenaPoolListResponseSchema = z.object({
  pools: z.array(arenaPoolSchema),
});

export const arenaPoolDetailResponseSchema = z.object({
  pool: arenaPoolSchema,
  queue: z.array(arenaQueueEntrySchema),
});

export const arenaEnterPoolRequestSchema = z.object({
  fighterId: z.number().int().positive(),
  agentVersionId: z.string().uuid().optional(),
});

export const arenaLeavePoolRequestSchema = z.object({
  fighterId: z.number().int().positive(),
});

export const arenaEnterPoolResponseSchema = z.object({
  entry: arenaQueueEntrySchema,
  match: z
    .object({
      simulationId: z.string().uuid(),
      broadcastId: z.string().min(1),
      matchedFighterIds: z.array(z.number().int().positive()),
    })
    .nullable(),
});

export const arenaLeavePoolResponseSchema = z.object({
  cancelled: z.boolean(),
});

export const arenaMyQueueEntrySchema = arenaQueueEntrySchema.extend({
  network: z.enum(WALLET_NETWORK_NAMES),
  battleMode: arenaBattleModeSchema,
  stakeAmountNative: z.string(),
  minFighters: z.number().int().positive(),
  maxFighters: z.number().int().positive(),
});

export const arenaMyQueueResponseSchema = z.object({
  entries: z.array(arenaMyQueueEntrySchema),
});

export const arenaMyActiveFighterSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string().nullable(),
  arenaStatus: fighterArenaStatusSchema,
  poolId: z.string().uuid().nullable(),
  simulationId: z.string().uuid().nullable(),
  battleMode: arenaBattleModeSchema.nullable(),
  stakeAmountNative: z.string().nullable(),
});

export const arenaMyActiveResponseSchema = z.object({
  fighters: z.array(arenaMyActiveFighterSchema),
});

export type ArenaPool = z.infer<typeof arenaPoolSchema>;
export type ArenaPoolListResponse = z.infer<typeof arenaPoolListResponseSchema>;
export type ArenaEnterPoolRequest = z.infer<typeof arenaEnterPoolRequestSchema>;
export type ArenaLeavePoolRequest = z.infer<typeof arenaLeavePoolRequestSchema>;
