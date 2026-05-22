import { db } from "@ijf/database";

import { getSuiUsdPrice } from "./fx";
import { getWalletBalanceMist, insertLedgerEntry } from "./ledger";
import type { WalletBalanceSnapshot } from "./types";
import { getFeeBps } from "./wallet-config";
import { ensureUserWallet } from "./wallet-provision";

const MIST_PER_SUI = 1_000_000_000;

const toChargeMist = (usd: number, suiUsd: number) => {
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(suiUsd) || suiUsd <= 0) {
    return 0n;
  }
  const mist = Math.ceil((usd / suiUsd) * MIST_PER_SUI);
  return BigInt(Math.max(0, mist));
};

const applyFeeBps = (amountMist: bigint, feeBps: number) => {
  if (amountMist <= 0n || feeBps <= 0) {
    return 0n;
  }
  const bps = BigInt(feeBps);
  return (amountMist * bps + 9_999n) / 10_000n;
};

export const buildWalletBalanceSnapshot = async ({
  executor,
  walletId,
  fxNativePerUsd,
}: {
  executor?: typeof db;
  walletId: string;
  fxNativePerUsd: number;
}): Promise<WalletBalanceSnapshot> => {
  const balanceMist = await getWalletBalanceMist(walletId, executor);
  const balanceUsd = fxNativePerUsd > 0 ? Number(balanceMist) / fxNativePerUsd : 0;

  return {
    walletId,
    balanceMist,
    balanceUsd,
    fxNativePerUsd,
  };
};

export const chargeForUsage = async ({
  executor,
  userId,
  llmUsageEventId,
  costUsd,
  correlationId,
}: {
  executor?: typeof db;
  userId: string;
  llmUsageEventId: string;
  costUsd: number;
  correlationId?: string;
}) => {
  const run = executor ?? db;
  const wallet = await ensureUserWallet({ executor: run, userId, network: "sui" });
  const suiUsd = await getSuiUsdPrice();
  const fxNativePerUsd = MIST_PER_SUI / suiUsd;
  const chargeMist = toChargeMist(costUsd, suiUsd);
  const feeMist = applyFeeBps(chargeMist, getFeeBps());

  if (chargeMist > 0n) {
    await insertLedgerEntry({
      executor: run,
      walletId: wallet.id,
      kind: "charge",
      amountMist: -chargeMist,
      amountUsdSnapshot: -Math.abs(costUsd),
      fxNativePerUsd,
      llmUsageEventId,
      correlationId,
    });
  }

  if (feeMist > 0n) {
    const feeUsd = (Number(feeMist) / MIST_PER_SUI) * suiUsd;
    await insertLedgerEntry({
      executor: run,
      walletId: wallet.id,
      kind: "fee",
      amountMist: -feeMist,
      amountUsdSnapshot: -Math.abs(feeUsd),
      fxNativePerUsd,
      llmUsageEventId,
      correlationId,
    });
  }

  return {
    wallet,
    chargeMist,
    feeMist,
    ...(await buildWalletBalanceSnapshot({
      executor: run,
      walletId: wallet.id,
      fxNativePerUsd,
    })),
  };
};
