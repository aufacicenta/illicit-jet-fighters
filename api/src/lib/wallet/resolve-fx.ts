import {
  getWalletCurrencyMetadata,
  type NetworkEnvName,
  WALLET_NETWORK_NAMES,
  type WalletNetworkName,
} from "@ijf/shared";

import { getSuiUsdPrice } from "./fx";

type NativeUsdPriceFetcher = () => Promise<number | null>;

const nativeUsdPriceByNetwork: Record<WalletNetworkName, NativeUsdPriceFetcher> = {
  sui: getSuiUsdPrice,
};

const isWalletNetworkName = (value: string): value is WalletNetworkName =>
  (WALLET_NETWORK_NAMES as readonly string[]).includes(value);

export const parseWalletNetworkName = (value: string): WalletNetworkName => {
  if (!isWalletNetworkName(value)) {
    throw new Error(`Unsupported wallet network: ${value}`);
  }
  return value;
};

export const getNativeUnitsPerWhole = (network: WalletNetworkName): bigint => {
  const { nativeDecimals } = getWalletCurrencyMetadata(network);
  return 10n ** BigInt(nativeDecimals);
};

export const getNativeUsdPrice = async (network: WalletNetworkName): Promise<number | null> => {
  const fetch = nativeUsdPriceByNetwork[network];
  if (!fetch) {
    return null;
  }
  return fetch();
};

/**
 * Native smallest-units (e.g. MIST) per 1 USD for ledger USD snapshots.
 * `network` selects currency decimals and price feed; `networkEnv` is reserved for env-specific overrides.
 * Returns `null` when the price feed is unavailable.
 */
export const resolveFxNativePerUsd = async (
  network: WalletNetworkName,
  _options?: { networkEnv?: NetworkEnvName },
): Promise<number | null> => {
  void _options;
  const nativePerWhole = getNativeUnitsPerWhole(network);
  const usdPerWhole = await getNativeUsdPrice(network);
  if (usdPerWhole === null || !Number.isFinite(usdPerWhole) || usdPerWhole <= 0) {
    return null;
  }
  return Number(nativePerWhole) / usdPerWhole;
};

export const usdToNativeAmount = async (
  usd: number,
  network: WalletNetworkName,
): Promise<bigint> => {
  if (!Number.isFinite(usd) || usd <= 0) {
    return 0n;
  }
  const fxNativePerUsd = await resolveFxNativePerUsd(network);
  if (fxNativePerUsd === null) {
    return 0n;
  }
  return BigInt(Math.max(0, Math.ceil(usd * fxNativePerUsd)));
};

export const nativeAmountToUsd = (amountNative: bigint, fxNativePerUsd: number): number => {
  if (fxNativePerUsd <= 0) {
    return 0;
  }
  return Number(amountNative) / fxNativePerUsd;
};
