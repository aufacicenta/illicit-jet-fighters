import { z } from "zod";

export const fighterLedgerEntryKindSchema = z.enum([
  "fighter_transfer_in",
  "fighter_transfer_out",
  "fighter_sim_bounty_in",
  "fighter_sim_bet_out",
]);

export const fighterLedgerEntrySchema = z.object({
  id: z.string(),
  kind: fighterLedgerEntryKindSchema,
  amountNative: z.string(),
  walletLedgerEntryId: z.string(),
  metadata: z.unknown(),
  createdAt: z.string(),
});

export const fighterLedgerSnapshotSchema = z.object({
  fighterId: z.number().int().positive(),
  fighterBalanceNative: z.string(),
  walletBalanceNative: z.string(),
  entries: z.array(fighterLedgerEntrySchema),
});

export type FighterLedgerEntry = z.infer<typeof fighterLedgerEntrySchema>;
export type FighterLedgerSnapshot = z.infer<typeof fighterLedgerSnapshotSchema>;
