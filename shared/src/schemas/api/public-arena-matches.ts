import { z } from "zod";

import { WALLET_NETWORK_NAMES } from "../../wallet-currency";
import { arenaBattleModeSchema, arenaQueueOpponentSchema, simulationStatusSchema } from "./arena";

export const publicArenaMatchesQuerySchema = z.object({
  limit: z.string().optional(),
});

export const publicArenaMatchSchema = z.object({
  simulationId: z.string().uuid(),
  broadcastId: z.string().min(1),
  network: z.enum(WALLET_NETWORK_NAMES),
  battleMode: arenaBattleModeSchema,
  stakeAmountNative: z.string(),
  totalStakeAmountNative: z.string(),
  matchedAt: z.string().datetime(),
  simulationStatus: simulationStatusSchema,
  winnerFighterId: z.number().int().positive().nullable(),
  participants: z.array(arenaQueueOpponentSchema).min(1),
});

export const publicArenaMatchesResponseSchema = z.object({
  matches: z.array(publicArenaMatchSchema),
});

export type PublicArenaMatch = z.infer<typeof publicArenaMatchSchema>;
export type PublicArenaMatchesQuery = z.infer<typeof publicArenaMatchesQuerySchema>;
export type PublicArenaMatchesResponse = z.infer<typeof publicArenaMatchesResponseSchema>;
