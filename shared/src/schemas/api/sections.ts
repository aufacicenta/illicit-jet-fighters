import { z } from "zod";

import { battlefieldSectionIdSchema } from "./battlefield-pipeline";
import { fighterSectionStatusSchema } from "./fighters";

export const apiSectionIdSchema = z.enum([
  "character-description",
  "specsheet-prompt",
  "specsheet-image",
  "spritesheet-prompt",
  "spritesheet-image",
  "spritesheet-manifest",
  "agent-code",
  "strikecraft-specsheet-prompt",
  "strikecraft-specsheet-image",
  "strikecraft-sprite-prompt",
  "strikecraft-sprite-image",
]);

export const apiSectionStatusSchema = fighterSectionStatusSchema;

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const apiSectionOutputSchema = z.object({
  sectionId: apiSectionIdSchema,
  content: z.string(),
  generatedAt: z.string(),
  model: z.string(),
  mimeType: z.string().optional(),
  assetUrl: z.string().optional(),
});

export const battlefieldApiSectionOutputSchema = z.object({
  sectionId: battlefieldSectionIdSchema,
  content: z.string(),
  generatedAt: z.string(),
  model: z.string(),
  mimeType: z.string().optional(),
  assetUrl: z.string().optional(),
});

export type ApiSectionId = z.infer<typeof apiSectionIdSchema>;
export type ApiSectionStatus = z.infer<typeof apiSectionStatusSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ApiSectionOutput = z.infer<typeof apiSectionOutputSchema>;
export type BattlefieldApiSectionOutput = z.infer<typeof battlefieldApiSectionOutputSchema>;
