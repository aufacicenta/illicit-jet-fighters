export const getMasterMnemonic = () => {
  const mnemonic = process.env.WALLET_MASTER_MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error("WALLET_MASTER_MNEMONIC is required for custodial wallet derivation.");
  }
  return mnemonic;
};
