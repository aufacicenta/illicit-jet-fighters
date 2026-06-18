import { db, eq, fighters } from "@ijf/database";

import { listSimulationParticipants } from "../simulation-repository";
import { appendSimulationSettlement } from "../wallet/ledger";
import { parseWalletNetworkName, resolveFxNativePerUsd } from "../wallet/resolve-fx";
import { getWalletNetworkEnv } from "../wallet/wallet-config";
import { ensureUserWallet } from "../wallet/wallet-provision";
import { unlockFighterStake } from "./balance-lock";
import {
  getPoolById,
  getQueueEntriesBySimulationId,
  getSimulationArenaPoolId,
  setFighterArenaStatus,
  syncFighterArenaStatus,
} from "./pool-repository";

export const settleArenaSimulation = async ({
  simulationId,
  winnerFighterId,
}: {
  simulationId: string;
  winnerFighterId: number | null;
}) => {
  const arenaPoolId = await getSimulationArenaPoolId(simulationId);
  if (!arenaPoolId) {
    return;
  }

  const pool = await getPoolById(arenaPoolId);
  if (!pool) {
    console.error("[arena-settlement] Pool not found", { simulationId, arenaPoolId });
    return;
  }

  const stakeAmountNative = BigInt(pool.stakeAmountNative);
  const participants = await listSimulationParticipants(simulationId);
  const queueEntries = await getQueueEntriesBySimulationId(simulationId);
  const lockByFighterId = new Map(
    queueEntries.map((entry) => [entry.fighterId, entry.lockCorrelationId]),
  );

  const network = parseWalletNetworkName(pool.network);
  const networkEnv = getWalletNetworkEnv();
  const fxNativePerUsd = (await resolveFxNativePerUsd(network, { networkEnv })) ?? 0;

  try {
    await Promise.all(participants.map((p) => setFighterArenaStatus(p.fighterId, "settling")));

    if (winnerFighterId === null) {
      for (const participant of participants) {
        const correlationId = lockByFighterId.get(participant.fighterId);
        if (!correlationId) {
          continue;
        }
        await unlockFighterStake({
          fighterId: participant.fighterId,
          amountNative: stakeAmountNative,
          correlationId,
          poolId: arenaPoolId,
          reason: "draw",
        });
      }
      return;
    }

    const losers = participants.filter((p) => p.fighterId !== winnerFighterId);
    for (const loser of losers) {
      const correlationId = lockByFighterId.get(loser.fighterId);
      if (correlationId) {
        await unlockFighterStake({
          fighterId: loser.fighterId,
          amountNative: stakeAmountNative,
          correlationId,
          poolId: arenaPoolId,
          reason: "settlement_prep",
        });
      }

      const ownerRows = await db
        .select({ userId: fighters.userId })
        .from(fighters)
        .where(eq(fighters.id, loser.fighterId))
        .limit(1);
      const ownerUserId = ownerRows[0]?.userId;
      if (!ownerUserId) {
        continue;
      }

      const wallet = await ensureUserWallet({ userId: ownerUserId, network });
      await appendSimulationSettlement({
        losingOwnerUserId: ownerUserId,
        losingOwnerWalletId: wallet.id,
        losingFighterId: loser.fighterId,
        winningFighterId: winnerFighterId,
        networkEnv,
        amountNative: stakeAmountNative,
        fxNativePerUsd,
        metadata: {
          simulationId,
          arenaPoolId,
        },
      });
    }
  } catch (error) {
    console.error("[arena-settlement] Settlement failed", {
      simulationId,
      arenaPoolId,
      winnerFighterId,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await Promise.all(
      participants.map((p) => syncFighterArenaStatus(p.fighterId, undefined, { force: true })),
    );
  }
};

export const releaseArenaSimulationOnError = async (simulationId: string) => {
  const arenaPoolId = await getSimulationArenaPoolId(simulationId);
  if (!arenaPoolId) {
    return;
  }

  const pool = await getPoolById(arenaPoolId);
  if (!pool) {
    return;
  }

  const stakeAmountNative = BigInt(pool.stakeAmountNative);
  const queueEntries = await getQueueEntriesBySimulationId(simulationId);
  const participants = await listSimulationParticipants(simulationId);

  try {
    for (const entry of queueEntries) {
      if (!entry.lockCorrelationId) {
        continue;
      }
      await unlockFighterStake({
        fighterId: entry.fighterId,
        amountNative: stakeAmountNative,
        correlationId: entry.lockCorrelationId,
        poolId: arenaPoolId,
        reason: "cancelled",
      });
    }
  } catch (error) {
    console.error("[arena-settlement] Error release failed", {
      simulationId,
      arenaPoolId,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await Promise.all(
      participants.map((p) => syncFighterArenaStatus(p.fighterId, undefined, { force: true })),
    );
  }
};
