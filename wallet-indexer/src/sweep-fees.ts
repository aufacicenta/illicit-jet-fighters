import { config } from "./config";
import { sweepAccumulated, type AccumulatedSweepConfig, type SweepResult } from "./sweep-common";

export type { SweepResult };

const FEE_SWEEP_CONFIG = {
  entryKind: "fee",
  sweepKind: "fee_sweep",
  logName: "sweep-fees",
  label: "fee",
  targetWallet: config.feesWallet,
} as const satisfies AccumulatedSweepConfig<"fee">;

/**
 * Sweeps accumulated fee ledger entries from user custodial wallets to the
 * configured FEES_WALLET address using SUI sponsored transactions.
 * The wallet-indexer pays for gas via a dedicated sponsor keypair.
 */
export const sweepAccumulatedFees = (): Promise<SweepResult> => sweepAccumulated(FEE_SWEEP_CONFIG);
