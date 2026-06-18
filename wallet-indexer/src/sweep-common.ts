import {
  and,
  db,
  eq,
  isNull,
  sql,
  userWallets,
  walletLedgerEntries,
  walletLedgerKindEnum,
} from "@ijf/database";

type WalletLedgerKind = (typeof walletLedgerKindEnum.enumValues)[number];
import { createLogger, serializeUnknownError } from "@ijf/shared/logger";
import { deriveSuiKeypair, getMasterMnemonic, getSponsorMnemonic } from "@ijf/shared/wallet";
import { Transaction } from "@mysten/sui/transactions";

import { config } from "./config";
import { prepareSponsoredTransfer, selectSenderCoins, suiClient } from "./sui-coins";

export type WalletAggregate = {
  walletId: string;
  derivationIndex: number;
  senderAddress: string;
  totalNative: bigint;
  entryIds: string[];
};

export type SweepResult = {
  totalSwept: bigint;
  walletsProcessed: number;
  errors: number;
};

export type SweepKindConfig = {
  /** Ledger entry kind to sweep (e.g. "fee", "charge") */
  entryKind: WalletLedgerKind;
  /** Ledger entry kind for the sweep record (e.g. "fee_sweep", "charge_sweep") */
  sweepKind: WalletLedgerKind;
  /** Logger name */
  logName: string;
  /** Human-readable label for log messages */
  label: string;
  /** Target wallet address from config */
  targetWallet: string | undefined;
};

/**
 * Finds all ledger entries of the given kind that have not yet been swept.
 * An entry is considered swept when a corresponding sweep entry with a
 * `tx_hash` exists for the same wallet. Only wallets whose aggregate meets
 * the sweep threshold are returned.
 */
export const findSweepableWallets = async (kind: WalletLedgerKind): Promise<WalletAggregate[]> => {
  const sweepKind = `${kind}_sweep` as WalletLedgerKind;

  const swept = db
    .select({ walletId: walletLedgerEntries.walletId })
    .from(walletLedgerEntries)
    .where(
      and(
        eq(walletLedgerEntries.kind, sweepKind),
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
        eq(walletLedgerEntries.kind, kind),
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
  const results: WalletAggregate[] = [];

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
 * Records a sweep ledger entry for the wallet with the on-chain tx hash.
 */
export const insertSweepEntry = async ({
  walletId,
  amountNative,
  txHash,
  targetAddress,
  sweptEntryIds,
  kind,
}: {
  walletId: string;
  amountNative: bigint;
  txHash: string;
  targetAddress: string;
  sweptEntryIds: string[];
  kind: WalletLedgerKind;
}) => {
  await db.insert(walletLedgerEntries).values({
    walletId,
    networkEnv: config.networkEnv,
    kind,
    amountNative: (-amountNative).toString(),
    amountUsdSnapshot: "0",
    fxNativePerUsd: "0",
    txHash,
    targetAddress,
    metadata: { sweptEntryIds },
  });
};

/**
 * Builds and executes a sponsored SUI transfer from a user wallet to a
 * target wallet. The sponsor (wallet-indexer) pays for gas.
 */
export const executeSponsoredTransfer = async ({
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
  const log = createLogger("executeSponsoredTransfer", {
    walletNetwork: config.walletNetwork,
    networkEnv: config.networkEnv,
  });

  const tx = new Transaction();
  tx.setSender(senderAddress);
  tx.setGasOwner(sponsorAddress);
  tx.setGasBudget(config.sweepGasBudget);

  const senderCoins = await selectSenderCoins(senderAddress, amount);
  log.info("Sender Coins", { senderCoins });

  await prepareSponsoredTransfer(tx, {
    senderCoins,
    amount,
    targetAddress,
    sponsorAddress,
  });

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

/**
 * Generic sweep loop: finds sweepable wallets, executes sponsored transfers,
 * and records sweep entries.
 */
export const sweepAccumulated = async (kindConfig: SweepKindConfig): Promise<SweepResult> => {
  const { entryKind, sweepKind, logName, label, targetWallet } = kindConfig;
  const startedAt = performance.now();

  const log = createLogger(logName, {
    walletNetwork: config.walletNetwork,
    networkEnv: config.networkEnv,
  });

  if (!targetWallet) {
    log.debug(`${logName} skipped: target wallet not configured`);
    return { totalSwept: 0n, walletsProcessed: 0, errors: 0 };
  }

  const sponsorKeypair = deriveSuiKeypair(getSponsorMnemonic(), 0);
  const sponsorAddress = sponsorKeypair.getPublicKey().toSuiAddress();

  log.info(`${label} sweep started`, {
    targetWallet,
    sponsorAddress,
    networkEnv: config.networkEnv,
    sweepThresholdNative: config.sweepThresholdNative.toString(),
  });

  let sweepableWallets: WalletAggregate[];

  try {
    sweepableWallets = await findSweepableWallets(entryKind);
  } catch (error) {
    const details = serializeUnknownError(error);
    log.error(`${label} sweep failed to query sweepable wallets`, {
      error: details.message ?? details.summary,
      errorDetails: details,
    });
    return { totalSwept: 0n, walletsProcessed: 0, errors: 1 };
  }

  if (sweepableWallets.length === 0) {
    log.debug(`${label} sweep completed: no wallets above threshold`);
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
    const senderKeypair = deriveSuiKeypair(getMasterMnemonic(), wallet.derivationIndex);
    const senderAddress = senderKeypair.toSuiAddress();

    if (senderAddress !== wallet.senderAddress) {
      throw new Error(`Sender does not equal derived address`);
    }

    const walletLogCtx = {
      walletId: wallet.walletId,
      senderAddress,
      derivationIndex: wallet.derivationIndex,
      amountNative: wallet.totalNative.toString(),
      entryCount: wallet.entryIds.length,
    };

    log.info(`sweeping wallet ${label}s`, { ...walletLogCtx, sponsorAddress });

    try {
      const txHash = await executeSponsoredTransfer({
        senderKeypair,
        senderAddress,
        sponsorKeypair,
        sponsorAddress,
        targetAddress: targetWallet,
        amount: wallet.totalNative,
      });

      log.info(`${label} sweep transfer confirmed`, { ...walletLogCtx, txHash });

      await insertSweepEntry({
        walletId: wallet.walletId,
        amountNative: wallet.totalNative,
        txHash,
        targetAddress: targetWallet,
        sweptEntryIds: wallet.entryIds,
        kind: sweepKind,
      });

      log.info(`${sweepKind} entry recorded`, {
        walletId: wallet.walletId,
        txHash,
        entriesSwept: wallet.entryIds.length,
      });

      totalSwept += wallet.totalNative;
      walletsProcessed += 1;
    } catch (error) {
      errors += 1;
      const details = serializeUnknownError(error);
      log.error(`${label} sweep failed for wallet`, {
        ...walletLogCtx,
        error: details.message ?? details.summary,
        errorDetails: details,
      });
    }
  }

  log.info(`${label} sweep completed`, {
    totalSwept: totalSwept.toString(),
    walletsProcessed,
    errors,
    durationMs: Math.round(performance.now() - startedAt),
  });

  return { totalSwept, walletsProcessed, errors };
};
