import path from "node:path";

import { parseNetworkEnvName } from "@ijf/shared";
import { loadEnvFiles, walletEnv, walletEnvSchema } from "@ijf/shared/config";
import { z } from "zod";

const walletIndexerDir = path.resolve(import.meta.dir, "..");

loadEnvFiles([path.join(walletIndexerDir, ".env.local"), path.join(walletIndexerDir, ".env")]);

const indexerEnvSchema = walletEnvSchema.extend({
  WALLET_INDEXER_POLL_MS: z.coerce.number().int().min(5000).default(15_000),
  WALLET_SPONSOR_MNEMONIC: z.string().min(1).optional(),
  API_BASE_URL: z.string().min(1).default("http://127.0.0.1:4000"),
  WALLET_INDEXER_SECRET: z.string().min(1).optional(),
  FEES_WALLET: z.string().min(1).optional(),
  CHARGES_WALLET: z.string().min(1).optional(),
  SWEEP_THRESHOLD_NATIVE: z.coerce.bigint().default(10_000_000n),
  SWEEP_GAS_BUDGET: z.coerce.number().int().min(0).default(10_000_000),
});

const parsed = indexerEnvSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid wallet-indexer environment configuration: ${details}`);
}
const indexerEnv = parsed.data;

export const config = {
  walletNetwork: walletEnv.WALLET_NETWORK,
  networkEnv: parseNetworkEnvName(walletEnv.WALLET_NETWORK_ENV),
  suiRpcUrl: walletEnv.SUI_RPC_URL,
  walletIndexerPollMs: indexerEnv.WALLET_INDEXER_POLL_MS,
  walletMasterMnemonic: walletEnv.WALLET_MASTER_MNEMONIC,
  walletSponsorMnemonic: indexerEnv.WALLET_SPONSOR_MNEMONIC,
  apiBaseUrl: indexerEnv.API_BASE_URL,
  walletIndexerSecret: indexerEnv.WALLET_INDEXER_SECRET,
  feesWallet: indexerEnv.FEES_WALLET,
  chargesWallet: indexerEnv.CHARGES_WALLET,
  sweepThresholdNative: indexerEnv.SWEEP_THRESHOLD_NATIVE,
  sweepGasBudget: indexerEnv.SWEEP_GAS_BUDGET,
};
