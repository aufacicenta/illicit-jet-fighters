import path from "node:path";

import { loadEnvFiles, walletEnvSchema } from "@ijf/shared/config";
import { z } from "zod";

const apiDir = path.resolve(import.meta.dir, "..", "..");

loadEnvFiles([path.join(apiDir, ".env.local"), path.join(apiDir, ".env")]);

if (
  process.env.MIN_WALLET_BALANCE_NATIVE === undefined &&
  process.env.MIN_WALLET_BALANCE_MIST !== undefined
) {
  process.env.MIN_WALLET_BALANCE_NATIVE = process.env.MIN_WALLET_BALANCE_MIST;
}

const apiEnvSchema = walletEnvSchema.extend({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  NEON_AUTH_URL: z.string().url(),
  OPENROUTER_API_KEY: z.string().min(1),
  WALLET_MASTER_MNEMONIC: z.string().min(1),
  FEE_BPS: z.coerce.number().int().min(0).default(2000),
  MIN_WALLET_BALANCE_NATIVE: z.coerce.number().int().min(0).default(50_000_000),
  MIN_SECTION_BUFFER_MULTIPLIER: z.coerce.number().min(1).default(1.5),
  WALLET_INDEXER_POLL_MS: z.coerce.number().int().min(5000).default(15_000),
  WALLET_INDEXER_SECRET: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_REGION: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  CORS_ORIGIN: z
    .string()
    .min(1)
    .default("http://localhost:5174")
    .transform((v) =>
      v
        .replace(/^["']+|["']+$/g, "")
        .trim()
        .replace(/\/+$/, ""),
    ),
});

const parsed = apiEnvSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid API environment configuration: ${details}`);
}

export const env = parsed.data;
