import type { NetworkEnvName } from "@ijf/shared";

import { sendToUser } from "../../ws/store";
import { buildWalletBalanceSnapshot } from "./charge";
import { getSuiUsdPrice } from "./fx";

const MIST_PER_SUI = 1_000_000_000;

export const pushWalletTopupNotifications = async ({
  userId,
  walletId,
  networkEnv,
  txHash,
  amountMist,
  amountUsd,
}: {
  userId: string;
  walletId: string;
  networkEnv: NetworkEnvName;
  txHash: string;
  amountMist: bigint;
  amountUsd: number;
}) => {
  const suiUsd = await getSuiUsdPrice();
  const fxNativePerUsd = MIST_PER_SUI / suiUsd;
  const balance = await buildWalletBalanceSnapshot({ walletId, networkEnv, fxNativePerUsd });
  const at = new Date().toISOString();

  sendToUser(userId, {
    type: "wallet:topup-detected",
    txHash,
    amountMist: amountMist.toString(),
    amountUsd: amountUsd.toFixed(8),
    at,
  });
  sendToUser(userId, {
    type: "wallet:balance-update",
    walletId,
    networkEnv,
    balanceMist: balance.balanceMist.toString(),
    balanceUsd: balance.balanceUsd.toFixed(8),
    fxNativePerUsd: balance.fxNativePerUsd.toFixed(12),
    at,
  });
};
