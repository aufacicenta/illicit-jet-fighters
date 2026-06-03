import type { NetworkEnvName } from "@ijf/shared";
import type { WalletNetworkName } from "@ijf/shared";

import { sendToUser } from "../../ws/store";
import { buildWalletBalanceSnapshot } from "./charge";
import { resolveFxNativePerUsd } from "./resolve-fx";

export const pushWalletTopupNotifications = async ({
  userId,
  walletId,
  network,
  networkEnv,
  txHash,
  amountNative,
  amountUsd,
}: {
  userId: string;
  walletId: string;
  network: WalletNetworkName;
  networkEnv: NetworkEnvName;
  txHash: string;
  amountNative: bigint;
  amountUsd: number;
}) => {
  const fxNativePerUsd = await resolveFxNativePerUsd(network, { networkEnv });
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
