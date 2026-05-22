import type { SectionId } from "../types";
import { getSuiUsdPrice } from "./fx";
import { getWalletBalanceMist } from "./ledger";
import { getMinSectionBufferMultiplier, getMinWalletBalanceMist } from "./wallet-config";
import { ensureUserWallet } from "./wallet-provision";

const MIST_PER_SUI = 1_000_000_000;

const estimatedSectionUsd: Record<SectionId, number> = {
  "character-description": 0.003,
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

const estimateRequiredMist = async (sectionId: SectionId) => {
  const suiUsd = await getSuiUsdPrice();
  const baseUsd = estimatedSectionUsd[sectionId] ?? 0.01;
  const bufferedUsd = baseUsd * getMinSectionBufferMultiplier();
  const convertedMist = BigInt(Math.ceil((bufferedUsd / suiUsd) * MIST_PER_SUI));
  const floorMist = getMinWalletBalanceMist();
  return convertedMist > floorMist ? convertedMist : floorMist;
};

export class InsufficientBalanceError extends Error {
  public readonly code = "INSUFFICIENT_BALANCE";

  constructor(
    public readonly sectionId: SectionId,
    public readonly requiredMist: bigint,
    public readonly balanceMist: bigint,
  ) {
    super(`Insufficient wallet balance for ${sectionId}. Required ${requiredMist} MIST.`);
  }
}

export const requirePreflightBalance = async ({
  userId,
  sectionId,
}: {
  userId: string;
  sectionId: SectionId;
}) => {
  const wallet = await ensureUserWallet({ userId, network: "sui" });
  const requiredMist = await estimateRequiredMist(sectionId);
  const balanceMist = await getWalletBalanceMist(wallet.id);

  if (balanceMist < requiredMist) {
    throw new InsufficientBalanceError(sectionId, requiredMist, balanceMist);
  }

  return { ok: true as const, balanceMist, requiredMist, walletId: wallet.id };
};
