import fs from "node:fs";
import path from "node:path";

import { parse as parseDotenv } from "dotenv";
import { z } from "zod";

const stripExportPrefixes = (raw: string) => raw.replace(/^\s*export\s+/gm, "");

const loadEnvFile = (filePath: string): void => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const parsed = parseDotenv(stripExportPrefixes(fs.readFileSync(filePath, "utf8")));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const apiDir = path.resolve(import.meta.dir, "..", "..");
const workspaceDir = path.resolve(apiDir, "..");

for (const filePath of [
  path.join(apiDir, ".env.local"),
  path.join(apiDir, ".env"),
  path.join(workspaceDir, ".env.local"),
  path.join(workspaceDir, ".env"),
]) {
  loadEnvFile(filePath);
}

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  NEON_AUTH_URL: z.string().url(),
  OPENROUTER_API_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1).optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_REGION: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid API environment configuration: ${details}`);
}

export const env = parsed.data;
