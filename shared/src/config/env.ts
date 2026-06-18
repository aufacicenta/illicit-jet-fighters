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
  if (!parsed || typeof parsed !== "object") {
    return;
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

export const loadEnvFiles = (paths: string[]): void => {
  for (const filePath of paths) {
    loadEnvFile(filePath);
  }
};

// `<shared>/src/config/env.ts` -> `<workspace>`
// shared is at <workspace>/shared, so go up three levels from this file.
const workspaceRoot = path.resolve(import.meta.dir, "..", "..", "..");

loadEnvFiles([path.join(workspaceRoot, ".env.local"), path.join(workspaceRoot, ".env")]);

export const walletEnvSchema = z.object({
  WALLET_MASTER_MNEMONIC: z.string().min(1).optional(),
  WALLET_NETWORK: z.enum(["sui"]).default("sui"),
  WALLET_NETWORK_ENV: z.enum(["testnet", "devnet", "mainnet"]).default("testnet"),
  SUI_RPC_URL: z.string().url().optional(),
});

type WalletEnv = z.infer<typeof walletEnvSchema>;

const parseWalletEnv = (): WalletEnv => {
  const parsed = walletEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid shared wallet environment configuration: ${details}`);
  }
  return parsed.data;
};

let cachedWalletEnv: WalletEnv | null = null;

export const getWalletEnv = (): WalletEnv => {
  if (cachedWalletEnv === null) {
    cachedWalletEnv = parseWalletEnv();
  }
  return cachedWalletEnv;
};

// Convenience export mirroring the lazy getter. Reads process.env on first
// access (after consumers have loaded their own .env files), then memoizes.
export const walletEnv = new Proxy({} as WalletEnv, {
  get(_target, prop: string) {
    const env = getWalletEnv();
    return env[prop as keyof WalletEnv];
  },
});
