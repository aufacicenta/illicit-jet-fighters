import {
  getWalletCurrencyMetadata,
  type NetworkEnvName,
  WALLET_NETWORK_NAMES,
  type WalletNetworkName,
} from "@ijf/shared";

import { getSuiUsdPrice } from "./fx";

type NativeUsdPriceFetcher = () => Promise<number>;

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

export const getNativeUsdPrice = async (network: WalletNetworkName): Promise<number> => {
  const fetch = nativeUsdPriceByNetwork[network];
  if (!fetch) {
    throw new Error(`No USD price feed configured for network: ${network}`);
  }
  return fetch();
};

/**
 * Native smallest-units (e.g. MIST) per 1 USD for ledger USD snapshots.
 * `network` selects currency decimals and price feed; `networkEnv` is reserved for env-specific overrides.
 */
export const resolveFxNativePerUsd = async (
  network: WalletNetworkName,
  _options?: { networkEnv?: NetworkEnvName },
): Promise<number> => {
  void _options;
  const nativePerWhole = getNativeUnitsPerWhole(network);
  const usdPerWhole = await getNativeUsdPrice(network);
  if (!Number.isFinite(usdPerWhole) || usdPerWhole <= 0) {
    throw new Error(`Invalid USD price for network: ${network}`);
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
  return BigInt(Math.max(0, Math.ceil(usd * fxNativePerUsd)));
};

export const nativeAmountToUsd = (amountNative: bigint, fxNativePerUsd: number): number => {
  if (fxNativePerUsd <= 0) {
    return 0;
  }
  return Number(amountNative) / fxNativePerUsd;
};
