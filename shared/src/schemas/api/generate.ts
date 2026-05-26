import { z } from "zod";

import { chatMessageSchema } from "./sections";

export const characterDescriptionRequestSchema = z.object({
  prompt: z.string().trim().min(1),
});

export const characterDescriptionResponseSchema = z.object({
  markdown: z.string(),
  model: z.string(),
});

export const characterDescriptionRefineRequestSchema = z.object({
  message: z.string().trim().min(1),
  history: z.array(chatMessageSchema),
});

export const specsheetPromptRequestSchema = z.object({
  characterDescription: z.string().trim().min(1),
});

export const specsheetPromptResponseSchema = z.object({
  prompt: z.string(),
  model: z.string(),
});

export const specsheetPromptRefineRequestSchema = z.object({
  message: z.string().trim().min(1),
  history: z.array(chatMessageSchema),
});

export const specsheetImageRequestSchema = z.object({
  prompt: z.string().trim().min(1),
});

export const specsheetImageResponseSchema = z.object({
  imageBase64: z.string(),
  mimeType: z.string(),
  model: z.string(),
});

export type CharacterDescriptionRequest = z.infer<typeof characterDescriptionRequestSchema>;
export type CharacterDescriptionResponse = z.infer<typeof characterDescriptionResponseSchema>;
export type CharacterDescriptionRefineRequest = z.infer<
  typeof characterDescriptionRefineRequestSchema
>;
export type SpecsheetPromptRequest = z.infer<typeof specsheetPromptRequestSchema>;
export type SpecsheetPromptResponse = z.infer<typeof specsheetPromptResponseSchema>;
export type SpecsheetPromptRefineRequest = z.infer<typeof specsheetPromptRefineRequestSchema>;
export type SpecsheetImageRequest = z.infer<typeof specsheetImageRequestSchema>;
export type SpecsheetImageResponse = z.infer<typeof specsheetImageResponseSchema>;
