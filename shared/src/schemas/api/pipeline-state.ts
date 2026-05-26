import { z } from "zod";

import { battlefieldSectionIdSchema } from "./battlefield-pipeline";
import {
  apiSectionIdSchema,
  apiSectionOutputSchema,
  apiSectionStatusSchema,
  battlefieldApiSectionOutputSchema,
  chatMessageSchema,
} from "./sections";

export const pipelineStateSnapshotSchema = z.object({
  sectionStatuses: z.record(apiSectionIdSchema, apiSectionStatusSchema),
  outputs: z.partialRecord(apiSectionIdSchema, apiSectionOutputSchema),
  histories: z.partialRecord(apiSectionIdSchema, z.array(chatMessageSchema)),
  gateMessage: z.string().nullable(),
  briefing: z.string().nullable(),
  fighterLedger: z.object({
    isReady: z.boolean(),
    balanceNative: z.string(),
  }),
});

export const battlefieldPipelineStateSnapshotSchema = z.object({
  sectionStatuses: z.record(battlefieldSectionIdSchema, apiSectionStatusSchema),
  outputs: z.partialRecord(battlefieldSectionIdSchema, battlefieldApiSectionOutputSchema),
  histories: z.partialRecord(battlefieldSectionIdSchema, z.array(chatMessageSchema)),
  gateMessage: z.string().nullable(),
  briefing: z.string().nullable(),
});

export type PipelineStateSnapshot = z.infer<typeof pipelineStateSnapshotSchema>;
export type BattlefieldPipelineStateSnapshot = z.infer<
  typeof battlefieldPipelineStateSnapshotSchema
>;
