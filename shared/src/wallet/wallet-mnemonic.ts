import { walletEnv } from "../config/env-schema";
import { registerSecret } from "../logger/redact";

let cachedMnemonic: string | null = null;
let cachedSponsorMnemonic: string | null = null;

const resolveMasterMnemonic = (): string => {
  const mnemonic = walletEnv.WALLET_MASTER_MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error("WALLET_MASTER_MNEMONIC is required for custodial wallet derivation.");
  }
  return mnemonic;
};

const resolveSponsorMnemonic = (): string => {
  const mnemonic = walletEnv.WALLET_SPONSOR_MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error(
      "WALLET_SPONSOR_MNEMONIC is required for sponsor wallet derivation. " +
        "Set it in the wallet-indexer environment.",
    );
  }
  return mnemonic;
};

export const getMasterMnemonic = (): string => {
  if (cachedMnemonic !== null) {
    return cachedMnemonic;
  }
  cachedMnemonic = resolveMasterMnemonic();
  registerSecret(cachedMnemonic);
  return cachedMnemonic;
};

export const getSponsorMnemonic = (): string => {
  if (cachedSponsorMnemonic !== null) {
    return cachedSponsorMnemonic;
  }
  cachedSponsorMnemonic = resolveSponsorMnemonic();
  registerSecret(cachedSponsorMnemonic);
  return cachedSponsorMnemonic;
};
