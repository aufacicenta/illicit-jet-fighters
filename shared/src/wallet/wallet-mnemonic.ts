import { walletEnv } from "../config";

let cachedMnemonic: string | null = null;

const resolveMasterMnemonic = (): string => {
  const mnemonic = walletEnv.WALLET_MASTER_MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error("WALLET_MASTER_MNEMONIC is required for custodial wallet derivation.");
  }
  return mnemonic;
};

export const getMasterMnemonic = (): string => {
  if (cachedMnemonic !== null) {
    return cachedMnemonic;
  }
  cachedMnemonic = resolveMasterMnemonic();
  return cachedMnemonic;
};
