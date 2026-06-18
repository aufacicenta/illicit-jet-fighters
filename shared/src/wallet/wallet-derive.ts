import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import { getMasterMnemonic, getSponsorMnemonic } from "./wallet-mnemonic";

export const getSuiDerivationPath = (derivationIndex: number) =>
  `m/44'/784'/${derivationIndex}'/0'/0'`;

export const deriveSuiKeypair = (mnemonic: string | undefined, derivationIndex: number) => {
  if (!Number.isInteger(derivationIndex) || derivationIndex < 0) {
    throw new Error("Wallet derivation index must be a non-negative integer.");
  }

  return Ed25519Keypair.deriveKeypair(
    mnemonic ?? getMasterMnemonic(),
    getSuiDerivationPath(derivationIndex),
  );
};

export const deriveSuiAddress = (derivationIndex: number) =>
  deriveSuiKeypair(undefined, derivationIndex).toSuiAddress();

/**
 * Derive the sponsor keypair from the dedicated sponsor mnemonic at a fixed
 * BIP44 path. The sponsor signs (and pays gas for) sponsored transactions
 * issued by the wallet-indexer; its mnemonic is separate from the master
 * mnemonic used for user custodial wallets.
 */
export const deriveSponsorSuiKeypair = () => {
  return Ed25519Keypair.deriveKeypair(getSponsorMnemonic(), getSuiDerivationPath(3));
};

export const deriveSponsorSuiAddress = () => deriveSponsorSuiKeypair().toSuiAddress();
