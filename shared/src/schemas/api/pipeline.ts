import { z } from "zod";

export const pipelineStartSchema = z.object({
  id: z.number().int().positive(),
  prompt: z.string().trim().min(1).max(10_000),
});

export type PipelineStartPayload = z.infer<typeof pipelineStartSchema>;

export const pipelineIdRequestSchema = z.object({
  id: z.number().int().positive(),
});

export const pipelineSpecsheetRequestSchema = pipelineIdRequestSchema.extend({
  characterDescription: z.string().trim().min(1),
});

export const pipelineStartResponseSchema = z.object({
  status: z.literal("started"),
});

export type PipelineIdRequest = z.infer<typeof pipelineIdRequestSchema>;
export type PipelineSpecsheetRequest = z.infer<typeof pipelineSpecsheetRequestSchema>;
export type PipelineStartResponse = z.infer<typeof pipelineStartResponseSchema>;
