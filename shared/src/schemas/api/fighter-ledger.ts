import { z } from "zod";

export const fighterLedgerEntryKindSchema = z.enum([
  "fighter_transfer_in",
  "fighter_transfer_out",
  "fighter_sim_bounty_in",
  "fighter_sim_bet_out",
  "fighter_arena_lock",
  "fighter_arena_unlock",
]);

export const fighterLedgerEntrySchema = z.object({
  id: z.string(),
  kind: fighterLedgerEntryKindSchema,
  amountNative: z.string(),
  walletLedgerEntryId: z.string().nullable(),
  metadata: z.unknown(),
  createdAt: z.string(),
});

export const fighterOpenArenaLockSchema = z.object({
  correlationId: z.string(),
  lockedAmountNative: z.string(),
  poolId: z.string().nullable(),
});

export const fighterLedgerSnapshotSchema = z.object({
  fighterId: z.number().int().positive(),
  fighterBalanceNative: z.string(),
  lockedBalanceNative: z.string(),
  availableBalanceNative: z.string(),
  walletBalanceNative: z.string(),
  openArenaLocks: z.array(fighterOpenArenaLockSchema),
  entries: z.array(fighterLedgerEntrySchema),
});

export const fighterArenaUnlockRequestSchema = z.object({
  correlationId: z.string().min(1),
});

export const fighterArenaUnlockResponseSchema = z.object({
  fighterId: z.number().int().positive(),
  correlationId: z.string(),
  unlockedAmountNative: z.string(),
  fighterBalanceNative: z.string(),
  lockedBalanceNative: z.string(),
  availableBalanceNative: z.string(),
});

export type FighterLedgerEntry = z.infer<typeof fighterLedgerEntrySchema>;
export type FighterLedgerSnapshot = z.infer<typeof fighterLedgerSnapshotSchema>;
export type FighterOpenArenaLock = z.infer<typeof fighterOpenArenaLockSchema>;
export type FighterArenaUnlockRequest = z.infer<typeof fighterArenaUnlockRequestSchema>;
export type FighterArenaUnlockResponse = z.infer<typeof fighterArenaUnlockResponseSchema>;
