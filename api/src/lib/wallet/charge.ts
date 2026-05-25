import { db } from "@ijf/database";
import type { NetworkEnvName } from "@ijf/shared";

import { getSuiUsdPrice } from "./fx";
import { getWalletBalanceMist, insertLedgerEntry } from "./ledger";
import type { WalletBalanceSnapshot } from "./types";
import { getFeeBps, getWalletNetwork, getWalletNetworkEnv } from "./wallet-config";
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
  networkEnv,
  fxNativePerUsd,
}: {
  executor?: typeof db;
  walletId: string;
  networkEnv: NetworkEnvName;
  fxNativePerUsd: number;
}): Promise<WalletBalanceSnapshot> => {
  const balanceMist = await getWalletBalanceMist(walletId, networkEnv, executor);
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
  const network = getWalletNetwork();
  const networkEnv = getWalletNetworkEnv();
  const wallet = await ensureUserWallet({ executor: run, userId, network });
  const suiUsd = await getSuiUsdPrice();
  const fxNativePerUsd = MIST_PER_SUI / suiUsd;
  const chargeMist = toChargeMist(costUsd, suiUsd);
  const feeMist = applyFeeBps(chargeMist, getFeeBps());
  let parentId: string | null = null;

  if (chargeMist > 0n) {
    const chargeEntry = await insertLedgerEntry({
      executor: run,
      walletId: wallet.id,
      networkEnv,
      kind: "charge",
      amountMist: -chargeMist,
      amountUsdSnapshot: -Math.abs(costUsd),
      fxNativePerUsd,
      llmUsageEventId,
      correlationId,
    });
    parentId = chargeEntry.id;
  }

  if (feeMist > 0n && parentId) {
    const feeUsd = (Number(feeMist) / MIST_PER_SUI) * suiUsd;
    await insertLedgerEntry({
      executor: run,
      walletId: wallet.id,
      networkEnv,
      kind: "fee",
      amountMist: -feeMist,
      amountUsdSnapshot: -Math.abs(feeUsd),
      fxNativePerUsd,
      llmUsageEventId,
      correlationId,
      parentId,
    });
  }

  return {
    wallet,
    chargeMist,
    feeMist,
    ...(await buildWalletBalanceSnapshot({
      executor: run,
      walletId: wallet.id,
      networkEnv,
      fxNativePerUsd,
    })),
  };
};
