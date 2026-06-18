import fs from "node:fs";
import path from "node:path";

import { parse as parseDotenv } from "dotenv";
import { defineConfig } from "drizzle-kit";
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

const configDir = path.resolve(import.meta.dir);
const databaseDir = path.resolve(configDir, ".");
const workspaceDir = path.resolve(databaseDir, "..");

for (const filePath of [
  path.join(workspaceDir, ".env.local"),
  path.join(workspaceDir, ".env"),
  path.join(workspaceDir, "api", ".env.local"),
  path.join(workspaceDir, "api", ".env"),
  path.join(databaseDir, ".env.local"),
  path.join(databaseDir, ".env"),
]) {
  loadEnvFile(filePath);
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid database environment configuration: ${details}`);
}

export const env = parsed.data;

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
