import { z } from "zod";

import { battlefieldSectionIdSchema } from "./battlefield-pipeline";
import { apiSectionIdSchema } from "./sections";

export const fighterCostSnapshotSchema = z.object({
  fighterId: z.number().int().positive(),
  totalCostUsd: z.string(),
  totalCostNative: z.string(),
  latestRunCorrelationId: z.string().nullable(),
  latestRunSectionCosts: z.partialRecord(apiSectionIdSchema, z.string()),
});

export const battlefieldCostSnapshotSchema = z.object({
  battlefieldId: z.number().int().positive(),
  totalCostUsd: z.string(),
  latestRunCorrelationId: z.string().nullable(),
  latestRunSectionCosts: z.partialRecord(battlefieldSectionIdSchema, z.string()),
});

export type FighterCostSnapshot = z.infer<typeof fighterCostSnapshotSchema>;
export type BattlefieldCostSnapshot = z.infer<typeof battlefieldCostSnapshotSchema>;
