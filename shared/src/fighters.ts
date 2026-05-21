import { z } from "zod";

export const pipelineStartSchema = z.object({
  id: z.number().int().positive(),
  prompt: z.string().trim().min(1).max(10_000),
});

export type PipelineStartPayload = z.infer<typeof pipelineStartSchema>;

export const fighterSectionStatusSchema = z.enum([
  "locked",
  "ready",
  "generating",
  "complete",
  "error",
]);

export const myFighterSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  name: z.string().nullable(),
  briefing: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  characterDescription: z.string().nullable(),
  specsheetPrompt: z.string().nullable(),
  specsheetImageUrl: z.string().url().nullable(),
  status: fighterSectionStatusSchema,
});

export const myFightersResponseSchema = z.object({
  fighters: z.array(myFighterSchema),
});

export const fighterAgentVersionSchema = z.object({
  id: z.string().uuid(),
  fighterId: z.number().int().positive(),
  versionNumber: z.number().int().positive(),
  model: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const fighterAgentVersionsResponseSchema = z.object({
  versions: z.array(fighterAgentVersionSchema),
});

export type FighterSectionStatus = z.infer<typeof fighterSectionStatusSchema>;
export type MyFighter = z.infer<typeof myFighterSchema>;
export type MyFightersResponse = z.infer<typeof myFightersResponseSchema>;
export type FighterAgentVersion = z.infer<typeof fighterAgentVersionSchema>;
export type FighterAgentVersionsResponse = z.infer<typeof fighterAgentVersionsResponseSchema>;
