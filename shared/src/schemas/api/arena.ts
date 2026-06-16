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

export const simulationStatusSchema = z.enum(["queued", "running", "ended", "error"]);

export const arenaMyQueueEntrySchema = arenaQueueEntrySchema.extend({
  network: z.enum(WALLET_NETWORK_NAMES),
  battleMode: arenaBattleModeSchema,
  stakeAmountNative: z.string(),
  minFighters: z.number().int().positive(),
  maxFighters: z.number().int().positive(),
  broadcastId: z.string().nullable(),
  winnerFighterId: z.number().int().positive().nullable(),
  simulationStatus: simulationStatusSchema.nullable(),
  fighterSlug: z.string().min(1),
  fighterName: z.string().nullable(),
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

export const arenaFighterEligibilityRequestSchema = z.object({
  fighterIds: z.array(z.number().int().positive()).min(1).max(50),
});

export const arenaFighterEligibilityItemSchema = z.object({
  fighterId: z.number().int().positive(),
  sectionStatuses: z.record(z.string(), z.string()),
  fighterBalanceNative: z.string(),
  availableBalanceNative: z.string(),
  versions: z.array(
    z.object({
      id: z.string().uuid(),
      versionNumber: z.number().int().positive(),
    }),
  ),
});

export const arenaFighterEligibilityResponseSchema = z.object({
  fighters: z.array(arenaFighterEligibilityItemSchema),
});

export type ArenaPool = z.infer<typeof arenaPoolSchema>;
export type ArenaPoolListResponse = z.infer<typeof arenaPoolListResponseSchema>;
export type ArenaEnterPoolRequest = z.infer<typeof arenaEnterPoolRequestSchema>;
export type ArenaLeavePoolRequest = z.infer<typeof arenaLeavePoolRequestSchema>;
export type ArenaFighterEligibilityRequest = z.infer<typeof arenaFighterEligibilityRequestSchema>;
export type ArenaFighterEligibilityResponse = z.infer<typeof arenaFighterEligibilityResponseSchema>;
export type ArenaFighterEligibilityItem = z.infer<typeof arenaFighterEligibilityItemSchema>;
