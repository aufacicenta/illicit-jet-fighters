import { z } from "zod";

export const battlefieldPipelineStartSchema = z.object({
  id: z.number().int().positive(),
  prompt: z.string().trim().min(1).max(10_000),
});

export type BattlefieldPipelineStartPayload = z.infer<typeof battlefieldPipelineStartSchema>;

export const battlefieldSectionIdSchema = z.enum([
  "battlefield-description",
  "battlefield-sheet-prompt",
  "battlefield-sheet-image",
  "battlefield-config",
]);

export type BattlefieldSectionId = z.infer<typeof battlefieldSectionIdSchema>;
