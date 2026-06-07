import type { SectionId } from "../types";
import { getWalletBalanceNative } from "./ledger";
import { usdToNativeAmount } from "./resolve-fx";
import {
  getMinSectionBufferMultiplier,
  getMinWalletBalanceNative,
  getWalletNetwork,
  getWalletNetworkEnv,
} from "./wallet-config";
import { ensureUserWallet } from "./wallet-provision";

const estimatedSectionUsd: Record<SectionId, number> = {
  "character-description": 0.003,
  "character-pfp-prompt": 0.003,
  "character-pfp-image": 0.012,
  "specsheet-prompt": 0.003,
  "specsheet-image": 0.012,
  "spritesheet-prompt": 0.003,
  "spritesheet-image": 0.012,
  "spritesheet-manifest": 0.003,
  "agent-code": 0.004,
  "strikecraft-specsheet-prompt": 0.003,
  "strikecraft-specsheet-image": 0.012,
  "strikecraft-sprite-prompt": 0.003,
  "strikecraft-sprite-image": 0.014,
  "battlefield-description": 0.004,
  "battlefield-sheet-prompt": 0.004,
  "battlefield-sheet-image": 0.014,
  "battlefield-config": 0.004,
};

const estimateRequiredNative = async (sectionId: SectionId) => {
  const network = getWalletNetwork();
  const baseUsd = estimatedSectionUsd[sectionId] ?? 0.01;
  const bufferedUsd = baseUsd * getMinSectionBufferMultiplier();
  const convertedNative = await usdToNativeAmount(bufferedUsd, network);
  const floorNative = getMinWalletBalanceNative();
  return convertedNative > floorNative ? convertedNative : floorNative;
};

export class InsufficientBalanceError extends Error {
  public readonly code = "INSUFFICIENT_BALANCE";

  constructor(
    public readonly sectionId: SectionId,
    public readonly requiredNative: bigint,
    public readonly balanceNative: bigint,
  ) {
    super(`Insufficient wallet balance for ${sectionId}. Required ${requiredNative} native.`);
  }
}

export const requirePreflightBalance = async ({
  userId,
  sectionId,
}: {
  userId: string;
  sectionId: SectionId;
}) => {
  const network = getWalletNetwork();
  const networkEnv = getWalletNetworkEnv();
  const wallet = await ensureUserWallet({ userId, network });
  const requiredNative = await estimateRequiredNative(sectionId);
  const balanceNative = await getWalletBalanceNative(wallet.id, networkEnv);

  if (balanceNative < requiredNative) {
    throw new InsufficientBalanceError(sectionId, requiredNative, balanceNative);
  }

  return { ok: true as const, balanceNative, requiredNative, walletId: wallet.id };
};

export const getPreflightBalanceSnapshot = async ({
  userId,
  sectionId,
}: {
  userId: string;
  sectionId: SectionId;
}) => {
  const network = getWalletNetwork();
  const networkEnv = getWalletNetworkEnv();
  const wallet = await ensureUserWallet({ userId, network });
  const requiredNative = await estimateRequiredNative(sectionId);
  const balanceNative = await getWalletBalanceNative(wallet.id, networkEnv);

  return {
    sufficient: balanceNative >= requiredNative,
    balanceNative: balanceNative.toString(),
    requiredNative: requiredNative.toString(),
  };
};
