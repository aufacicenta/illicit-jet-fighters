export const NETWORK_ENV_NAMES = ["testnet", "devnet", "mainnet"] as const;

export type NetworkEnvName = (typeof NETWORK_ENV_NAMES)[number];

export const isNetworkEnvName = (value: string): value is NetworkEnvName =>
  NETWORK_ENV_NAMES.includes(value as NetworkEnvName);

export const parseNetworkEnvName = (
  value: string | undefined,
  fallback: NetworkEnvName = "testnet",
): NetworkEnvName => {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }
  return isNetworkEnvName(normalized) ? normalized : fallback;
};
