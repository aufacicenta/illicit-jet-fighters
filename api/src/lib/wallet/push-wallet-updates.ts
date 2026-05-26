import type { NetworkEnvName } from "@ijf/shared";

import { sendToUser } from "../../ws/store";
import { buildWalletBalanceSnapshot } from "./charge";
import { getSuiUsdPrice } from "./fx";

const NATIVE_BASE_UNITS_PER_SUI = 1_000_000_000;

export const pushWalletTopupNotifications = async ({
  userId,
  walletId,
  networkEnv,
  txHash,
  amountNative,
  amountUsd,
}: {
  userId: string;
  walletId: string;
  networkEnv: NetworkEnvName;
  txHash: string;
  amountNative: bigint;
  amountUsd: number;
}) => {
  const suiUsd = await getSuiUsdPrice();
  const fxNativePerUsd = NATIVE_BASE_UNITS_PER_SUI / suiUsd;
  const balance = await buildWalletBalanceSnapshot({ walletId, networkEnv, fxNativePerUsd });
  const at = new Date().toISOString();

  sendToUser(userId, {
    type: "wallet:topup-detected",
    txHash,
    amountNative: amountNative.toString(),
    amountUsd: amountUsd.toFixed(8),
    at,
  });
  sendToUser(userId, {
    type: "wallet:balance-update",
    walletId,
    networkEnv,
    balanceNative: balance.balanceNative.toString(),
    balanceUsd: balance.balanceUsd.toFixed(8),
    fxNativePerUsd: balance.fxNativePerUsd.toFixed(12),
    at,
  });
};
