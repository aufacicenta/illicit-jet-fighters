import { config } from "./config";
import { sweepAccumulated, type SweepResult } from "./sweep-common";

export type { SweepResult };

/**
 * Sweeps accumulated charge ledger entries from user custodial wallets to the
 * configured CHARGES_WALLET address using SUI sponsored transactions.
 * The wallet-indexer pays for gas via a dedicated sponsor keypair.
 */
export const sweepAccumulatedCharges = (): Promise<SweepResult> =>
  sweepAccumulated({
    entryKind: "charge",
    sweepKind: "charge_sweep",
    logName: "sweep-charges",
    label: "charge",
    targetWallet: config.chargesWallet,
  });
