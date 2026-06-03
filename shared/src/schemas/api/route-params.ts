import { z } from "zod";

export const fighterIdPathParamsSchema = z.object({
  id: z.string(),
});

export const battlefieldIdPathParamsSchema = z.object({
  id: z.string(),
});

export const fighterLedgerPathParamsSchema = z.object({
  fighterId: z.string(),
});

export const simulationIdPathParamsSchema = z.object({
  id: z.string().min(1),
});

export const broadcastIdPathParamsSchema = z.object({
  id: z.string().min(1),
});

export const arenaPoolIdPathParamsSchema = z.object({
  poolId: z.string().uuid(),
});

export const withdrawalGroupPathParamsSchema = z.object({
  groupId: z.string().min(1),
});

export const limitQuerySchema = z.object({
  limit: z.string().optional(),
});

export const walletLedgerQuerySchema = z.object({
  limit: z.string().optional(),
  cursor: z.string().optional(),
});
