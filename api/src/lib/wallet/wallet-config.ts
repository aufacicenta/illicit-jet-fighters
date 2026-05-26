import {
  getMasterMnemonic as getMasterMnemonicFromDatabase,
  type WalletNetwork,
} from "@ijf/database";
import { type NetworkEnvName, parseNetworkEnvName } from "@ijf/shared";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

const parseInteger = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseFloatValue = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getMasterMnemonic = getMasterMnemonicFromDatabase;

export const getWalletNetwork = (): WalletNetwork => {
  const network = process.env.WALLET_NETWORK?.trim();
  return network === "sui" ? network : "sui";
};

export const getWalletNetworkEnv = (): NetworkEnvName =>
  parseNetworkEnvName(process.env.WALLET_NETWORK_ENV);

export const getSuiRpcUrl = () =>
  process.env.SUI_RPC_URL?.trim() || getJsonRpcFullnodeUrl(getWalletNetworkEnv());

export const getFeeBps = () => {
  const value = parseInteger(process.env.FEE_BPS, 2000);
  return Math.max(0, value);
};

export const getMinWalletBalanceNative = () =>
  BigInt(
    parseInteger(
      process.env.MIN_WALLET_BALANCE_NATIVE ?? process.env.MIN_WALLET_BALANCE_MIST,
      50_000_000,
    ),
  );

export const getMinSectionBufferMultiplier = () =>
  Math.max(1, parseFloatValue(process.env.MIN_SECTION_BUFFER_MULTIPLIER, 1.5));

export const getWalletIndexerPollMs = () =>
  Math.max(5_000, parseInteger(process.env.WALLET_INDEXER_POLL_MS, 15_000));
