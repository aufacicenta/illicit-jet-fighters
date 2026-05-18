import { z } from "zod";

export const pipelineStartSchema = z.object({
  id: z.number().int().positive(),
  prompt: z.string().trim().min(1).max(10_000),
});

export type PipelineStartPayload = z.infer<typeof pipelineStartSchema>;
