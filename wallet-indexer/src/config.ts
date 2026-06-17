import path from "node:path";

import { parseNetworkEnvName } from "@ijf/shared";
import { config as loadDotEnv } from "dotenv";

const workspaceRoot = path.resolve(import.meta.dir, "..", "..");
loadDotEnv({ path: path.join(workspaceRoot, ".env.local"), override: false });
loadDotEnv({ path: path.join(workspaceRoot, ".env"), override: false });
loadDotEnv({ path: path.join(workspaceRoot, "api", ".env.local"), override: false });

const parseIntStrict = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  walletNetwork: process.env.WALLET_NETWORK?.trim() === "sui" ? "sui" : "sui",
  networkEnv: parseNetworkEnvName(process.env.WALLET_NETWORK_ENV),
  suiRpcUrl: process.env.SUI_RPC_URL?.trim(),
  walletIndexerPollMs: Math.max(5_000, parseIntStrict(process.env.WALLET_INDEXER_POLL_MS, 15_000)),
  walletMasterMnemonic: process.env.WALLET_MASTER_MNEMONIC?.trim(),
  apiBaseUrl: process.env.API_BASE_URL?.trim() || "http://127.0.0.1:4000",
  walletIndexerSecret: process.env.WALLET_INDEXER_SECRET?.trim(),
  feesWallet: process.env.FEES_WALLET?.trim(),
  chargesWallet: process.env.CHARGES_WALLET?.trim(),
  sweepThresholdNative: BigInt(parseIntStrict(process.env.SWEEP_THRESHOLD_NATIVE, 10_000_000)),
  sweepGasBudget: parseIntStrict(process.env.SWEEP_GAS_BUDGET, 10_000_000),
  sponsorDerivationIndex: parseIntStrict(process.env.SPONSOR_DERIVATION_INDEX, 999),
};
