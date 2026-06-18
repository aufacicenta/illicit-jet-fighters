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

const databaseDir = path.resolve(import.meta.dir, "..", "..");
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
  WALLET_MASTER_MNEMONIC: z.string().min(1).optional(),
  WALLET_NETWORK: z.enum(["sui"]).default("sui"),
  WALLET_NETWORK_ENV: z.enum(["testnet", "devnet", "mainnet"]).default("testnet"),
  SUI_RPC_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid database environment configuration: ${details}`);
}

export const env = parsed.data;
