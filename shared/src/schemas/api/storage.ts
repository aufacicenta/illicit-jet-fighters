import { z } from "zod";

export const fighterAgentPackageRequestSchema = z.object({
  agentSlug: z.string().trim().min(1),
});

export const fighterSpecsheetAssetResponseSchema = z.object({
  signedUrl: z.string().url(),
});

export const fighterAgentPackageResponseSchema = z.object({
  key: z.string().min(1),
});

export type FighterAgentPackageRequest = z.infer<typeof fighterAgentPackageRequestSchema>;
export type FighterSpecsheetAssetResponse = z.infer<typeof fighterSpecsheetAssetResponseSchema>;
export type FighterAgentPackageResponse = z.infer<typeof fighterAgentPackageResponseSchema>;
