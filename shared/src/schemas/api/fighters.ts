import { z } from "zod";

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
  arenaStatus: z.enum(["idle", "queued", "in_simulation", "settling"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  characterDescription: z.string().nullable(),
  specsheetPrompt: z.string().nullable(),
  specsheetImageUrl: z.string().url().nullable(),
  pfpUrl: z.string().url().nullable(),
  pfpGridUrl: z.string().url().nullable().optional(),
  pfpAvatarUrl: z.string().url().nullable().optional(),
  spriteUrl: z.string().url().nullable(),
  spriteGridUrl: z.string().url().nullable().optional(),
  spriteAvatarUrl: z.string().url().nullable().optional(),
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
  hasCheckpoint: z.boolean().optional(),
  createdAt: z.string().datetime(),
});

export const fighterCheckpointResponseSchema = z.object({
  signedUrl: z.string().url(),
  simulationId: z.string().uuid().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime().nullable(),
});

export const fighterAgentVersionsResponseSchema = z.object({
  versions: z.array(fighterAgentVersionSchema),
});

export const fighterIdResponseSchema = z.object({
  id: z.number().int().positive(),
});

export const fighterIntakeResponseSchema = z.object({
  id: z.number().int().positive(),
  resumed: z.boolean(),
});

export const publicFighterSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  name: z.string().nullable(),
  epithet: z.string().nullable(),
  pfpUrl: z.string().url().nullable(),
  pfpGridUrl: z.string().url().nullable().optional(),
  pfpAvatarUrl: z.string().url().nullable().optional(),
  spriteUrl: z.string().url().nullable(),
  spriteGridUrl: z.string().url().nullable().optional(),
  spriteAvatarUrl: z.string().url().nullable().optional(),
  wins: z.number().int().nonnegative(),
  balanceNative: z.string(),
  createdAt: z.string().datetime(),
});

export const publicFighterDetailSchema = publicFighterSchema.extend({
  briefing: z.string().nullable(),
  specsheetImageUrl: z.string().url().nullable(),
  strikecraftSpecsheetImageUrl: z.string().url().nullable(),
});

export const publicFightersQuerySchema = z.object({
  sort: z.enum(["latest", "wins"]).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export const publicFightersResponseSchema = z.object({
  fighters: z.array(publicFighterSchema),
});

export type FighterSectionStatus = z.infer<typeof fighterSectionStatusSchema>;
export type MyFighter = z.infer<typeof myFighterSchema>;
export type MyFightersResponse = z.infer<typeof myFightersResponseSchema>;
export type FighterAgentVersion = z.infer<typeof fighterAgentVersionSchema>;
export type FighterAgentVersionsResponse = z.infer<typeof fighterAgentVersionsResponseSchema>;
export type FighterCheckpointResponse = z.infer<typeof fighterCheckpointResponseSchema>;
export type FighterIdResponse = z.infer<typeof fighterIdResponseSchema>;
export type FighterIntakeResponse = z.infer<typeof fighterIntakeResponseSchema>;
export type PublicFighter = z.infer<typeof publicFighterSchema>;
export type PublicFighterDetail = z.infer<typeof publicFighterDetailSchema>;
export type PublicFightersQuery = z.infer<typeof publicFightersQuerySchema>;
export type PublicFightersResponse = z.infer<typeof publicFightersResponseSchema>;
