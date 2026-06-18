import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import { getMasterMnemonic } from "./wallet-mnemonic";

export const getSuiDerivationPath = (derivationIndex: number) =>
  `m/44'/784'/${derivationIndex}'/0'/0'`;

export const deriveSuiKeypair = (derivationIndex: number) => {
  if (!Number.isInteger(derivationIndex) || derivationIndex < 0) {
    throw new Error("Wallet derivation index must be a non-negative integer.");
  }

  return Ed25519Keypair.deriveKeypair(getMasterMnemonic(), getSuiDerivationPath(derivationIndex));
};

export const deriveSuiAddress = (derivationIndex: number) =>
  deriveSuiKeypair(derivationIndex).toSuiAddress();
