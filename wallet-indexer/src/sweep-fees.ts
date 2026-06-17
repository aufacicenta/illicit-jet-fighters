import {
  and,
  db,
  deriveSuiKeypair,
  eq,
  isNull,
  sql,
  userWallets,
  walletLedgerEntries,
} from "@ijf/database";
import { createLogger, serializeUnknownError } from "@ijf/shared/logger";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";

import { config } from "./config";

const log = createLogger("sweep-fees");

const suiClient = new SuiJsonRpcClient({
  network: config.networkEnv,
  url: config.suiRpcUrl || getJsonRpcFullnodeUrl(config.networkEnv),
});

type WalletFeeAggregate = {
  walletId: string;
  derivationIndex: number;
  senderAddress: string;
  totalNative: bigint;
  entryIds: string[];
};

/**
 * Finds all `fee` ledger entries that have not yet been swept.
 * A fee is considered swept when a `fee_sweep` entry with a `tx_hash` exists
 * for the same wallet. Only wallets whose aggregate meets the sweep threshold
 * are returned.
 */
const findSweepableWallets = async (): Promise<WalletFeeAggregate[]> => {
  const swept = db
    .select({ walletId: walletLedgerEntries.walletId })
    .from(walletLedgerEntries)
    .where(
      and(
        eq(walletLedgerEntries.kind, "fee_sweep"),
        eq(walletLedgerEntries.networkEnv, config.networkEnv),
        sql`${walletLedgerEntries.txHash} IS NOT NULL`,
      ),
    )
    .as("swept");

  const rows = await db
    .select({
      entryId: walletLedgerEntries.id,
      walletId: walletLedgerEntries.walletId,
      amountNative: walletLedgerEntries.amountNative,
      derivationIndex: userWallets.derivationIndex,
      address: userWallets.address,
    })
    .from(walletLedgerEntries)
    .innerJoin(userWallets, eq(walletLedgerEntries.walletId, userWallets.id))
    .leftJoin(swept, eq(walletLedgerEntries.walletId, swept.walletId))
    .where(
      and(
        eq(walletLedgerEntries.kind, "fee"),
        eq(walletLedgerEntries.networkEnv, config.networkEnv),
        isNull(swept.walletId),
      ),
    );

  if (rows.length === 0) {
    return [];
  }

  const byWallet = new Map<
    string,
    {
      derivationIndex: number;
      address: string;
      totalNative: bigint;
      entryIds: string[];
    }
  >();

  for (const row of rows) {
    let group = byWallet.get(row.walletId);
    if (!group) {
      group = {
        derivationIndex: row.derivationIndex,
        address: row.address,
        totalNative: 0n,
        entryIds: [],
      };
      byWallet.set(row.walletId, group);
    }
    const absAmount = BigInt(row.amountNative.replace("-", ""));
    group.totalNative += absAmount;
    group.entryIds.push(row.entryId);
  }

  const threshold = config.sweepThresholdNative;
  const results: WalletFeeAggregate[] = [];

  for (const [walletId, group] of byWallet) {
    if (group.totalNative >= threshold) {
      results.push({
        walletId,
        derivationIndex: group.derivationIndex,
        senderAddress: group.address,
        totalNative: group.totalNative,
        entryIds: group.entryIds,
      });
    }
  }

  return results;
};

/**
 * Records a `fee_sweep` ledger entry for the wallet with the on-chain tx hash.
 * The existence of this row (with a non-null tx_hash) is what marks the
 * wallet's fee entries as swept.
 */
const insertFeeSweepEntry = async ({
  walletId,
  amountNative,
  txHash,
  targetAddress,
  sweptEntryIds,
}: {
  walletId: string;
  amountNative: bigint;
  txHash: string;
  targetAddress: string;
  sweptEntryIds: string[];
}) => {
  await db.insert(walletLedgerEntries).values({
    walletId,
    networkEnv: config.networkEnv,
    kind: "fee_sweep",
    amountNative: (-amountNative).toString(),
    amountUsdSnapshot: "0",
    fxNativePerUsd: "0",
    txHash,
    targetAddress,
    metadata: { sweptEntryIds },
  });
};

/**
 * Builds and executes a sponsored SUI transfer from a user wallet to the
 * fees wallet. The sponsor (wallet-indexer) pays for gas.
 */
const executeSponsoredTransfer = async ({
  senderKeypair,
  senderAddress,
  sponsorKeypair,
  sponsorAddress,
  targetAddress,
  amount,
}: {
  senderKeypair: ReturnType<typeof deriveSuiKeypair>;
  senderAddress: string;
  sponsorKeypair: ReturnType<typeof deriveSuiKeypair>;
  sponsorAddress: string;
  targetAddress: string;
  amount: bigint;
}): Promise<string> => {
  const tx = new Transaction();
  tx.setSender(senderAddress);
  tx.setGasOwner(sponsorAddress);
  tx.setGasBudget(config.sweepGasBudget);
  tx.setGasPayment([]);

  tx.transferObjects(
    [tx.coin({ balance: amount, useGasCoin: false })],
    tx.pure.address(targetAddress),
  );

  const bytes = await tx.build({ client: suiClient });

  const { signature: senderSig } = await senderKeypair.signTransaction(bytes);
  const { signature: sponsorSig } = await sponsorKeypair.signTransaction(bytes);

  const result = await suiClient.executeTransactionBlock({
    transactionBlock: bytes,
    signature: [senderSig, sponsorSig],
    options: { showEffects: true },
  });

  const digest = result.digest;
  if (!digest) {
    throw new Error("Missing SUI transaction digest after execution.");
  }

  const confirmed = await suiClient.waitForTransaction({
    digest,
    options: { showEffects: true },
  });

  const status = confirmed.effects?.status?.status;
  if (status !== "success") {
    const errorMsg = confirmed.effects?.status?.error ?? "transaction failed on-chain";
    throw new Error(`Sweep transaction ${digest} failed: ${errorMsg}`);
  }

  return digest;
};

export type SweepResult = {
  totalSwept: bigint;
  walletsProcessed: number;
  errors: number;
};

/**
 * Sweeps accumulated fee ledger entries from user custodial wallets to the
 * configured FEES_WALLET address using SUI sponsored transactions.
 * The wallet-indexer pays for gas via a dedicated sponsor keypair.
 */
export const sweepAccumulatedFees = async (): Promise<SweepResult> => {
  const startedAt = performance.now();

  const feesWallet = config.feesWallet;
  if (!feesWallet) {
    log.debug("sweep-fees skipped: FEES_WALLET not configured");
    return { totalSwept: 0n, walletsProcessed: 0, errors: 0 };
  }

  const sponsorKeypair = deriveSuiKeypair(config.sponsorDerivationIndex);
  const sponsorAddress = sponsorKeypair.getPublicKey().toSuiAddress();

  log.info("fee sweep started", {
    feesWallet,
    sponsorAddress,
    networkEnv: config.networkEnv,
    sweepThresholdNative: config.sweepThresholdNative.toString(),
  });

  let sweepableWallets: WalletFeeAggregate[];

  try {
    sweepableWallets = await findSweepableWallets();
  } catch (error) {
    const details = serializeUnknownError(error);
    log.error("fee sweep failed to query sweepable wallets", {
      error: details.message ?? details.summary,
      errorDetails: details,
    });
    return { totalSwept: 0n, walletsProcessed: 0, errors: 1 };
  }

  if (sweepableWallets.length === 0) {
    log.debug("fee sweep completed: no wallets above threshold");
    return { totalSwept: 0n, walletsProcessed: 0, errors: 0 };
  }

  log.info("sweepable wallets found", {
    count: sweepableWallets.length,
    totalEntries: sweepableWallets.reduce((sum, w) => sum + w.entryIds.length, 0),
  });

  let totalSwept = 0n;
  let walletsProcessed = 0;
  let errors = 0;

  for (const wallet of sweepableWallets) {
    const walletLogCtx = {
      walletId: wallet.walletId,
      senderAddress: wallet.senderAddress,
      derivationIndex: wallet.derivationIndex,
      amountNative: wallet.totalNative.toString(),
      entryCount: wallet.entryIds.length,
    };

    log.info("sweeping wallet fees", walletLogCtx);

    try {
      const senderKeypair = deriveSuiKeypair(wallet.derivationIndex);

      const txHash = await executeSponsoredTransfer({
        senderKeypair,
        senderAddress: wallet.senderAddress,
        sponsorKeypair,
        sponsorAddress,
        targetAddress: feesWallet,
        amount: wallet.totalNative,
      });

      log.info("fee sweep transfer confirmed", { ...walletLogCtx, txHash });

      await insertFeeSweepEntry({
        walletId: wallet.walletId,
        amountNative: wallet.totalNative,
        txHash,
        targetAddress: feesWallet,
        sweptEntryIds: wallet.entryIds,
      });

      log.info("fee_sweep entry recorded", {
        walletId: wallet.walletId,
        txHash,
        entriesSwept: wallet.entryIds.length,
      });

      totalSwept += wallet.totalNative;
      walletsProcessed += 1;
    } catch (error) {
      errors += 1;
      const details = serializeUnknownError(error);
      log.error("fee sweep failed for wallet", {
        ...walletLogCtx,
        error: details.message ?? details.summary,
        errorDetails: details,
      });
    }
  }

  log.info("fee sweep completed", {
    totalSwept: totalSwept.toString(),
    walletsProcessed,
    errors,
    durationMs: Math.round(performance.now() - startedAt),
  });

  return { totalSwept, walletsProcessed, errors };
};
