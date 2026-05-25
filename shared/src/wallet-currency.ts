export const WALLET_NETWORK_NAMES = ["sui"] as const;

export type WalletNetworkName = (typeof WALLET_NETWORK_NAMES)[number];

export type WalletCurrencyMetadata = {
  symbol: string;
  nativeSymbol: string;
  nativeDecimals: number;
};

export const WALLET_CURRENCY_BY_NETWORK: Record<WalletNetworkName, WalletCurrencyMetadata> = {
  sui: {
    symbol: "SUI",
    nativeSymbol: "MIST",
    nativeDecimals: 9,
  },
};

export const getWalletCurrencyMetadata = (network: WalletNetworkName): WalletCurrencyMetadata =>
  WALLET_CURRENCY_BY_NETWORK[network];
