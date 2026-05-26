import { db } from "@ijf/database";
import type { NetworkEnvName } from "@ijf/shared";

import { getSuiUsdPrice } from "./fx";
import { getWalletBalanceNative, insertLedgerEntry } from "./ledger";
import type { WalletBalanceSnapshot } from "./types";
import { getFeeBps, getWalletNetwork, getWalletNetworkEnv } from "./wallet-config";
import { ensureUserWallet } from "./wallet-provision";

const NATIVE_BASE_UNITS_PER_SUI = 1_000_000_000;

const toChargeNative = (usd: number, suiUsd: number) => {
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(suiUsd) || suiUsd <= 0) {
    return 0n;
  }
  const native = Math.ceil((usd / suiUsd) * NATIVE_BASE_UNITS_PER_SUI);
  return BigInt(Math.max(0, native));
};

const applyFeeBps = (amountNative: bigint, feeBps: number) => {
  if (amountNative <= 0n || feeBps <= 0) {
    return 0n;
  }
  const bps = BigInt(feeBps);
  return (amountNative * bps + 9_999n) / 10_000n;
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
  const balanceNative = await getWalletBalanceNative(walletId, networkEnv, executor);
  const balanceUsd = fxNativePerUsd > 0 ? Number(balanceNative) / fxNativePerUsd : 0;

  return {
    walletId,
    balanceNative,
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
  const fxNativePerUsd = NATIVE_BASE_UNITS_PER_SUI / suiUsd;
  const chargeNative = toChargeNative(costUsd, suiUsd);
  const feeNative = applyFeeBps(chargeNative, getFeeBps());
  let parentId: string | null = null;

  if (chargeNative > 0n) {
    const chargeEntry = await insertLedgerEntry({
      executor: run,
      walletId: wallet.id,
      networkEnv,
      kind: "charge",
      amountNative: -chargeNative,
      amountUsdSnapshot: -Math.abs(costUsd),
      fxNativePerUsd,
      llmUsageEventId,
      correlationId,
    });
    parentId = chargeEntry.id;
  }

  if (feeNative > 0n && parentId) {
    const feeUsd = (Number(feeNative) / NATIVE_BASE_UNITS_PER_SUI) * suiUsd;
    await insertLedgerEntry({
      executor: run,
      walletId: wallet.id,
      networkEnv,
      kind: "fee",
      amountNative: -feeNative,
      amountUsdSnapshot: -Math.abs(feeUsd),
      fxNativePerUsd,
      llmUsageEventId,
      correlationId,
      parentId,
    });
  }

  return {
    wallet,
    chargeNative,
    feeNative,
    ...(await buildWalletBalanceSnapshot({
      executor: run,
      walletId: wallet.id,
      networkEnv,
      fxNativePerUsd,
    })),
  };
};
