import {
  and,
  db,
  eq,
  sql,
  userWallets,
  walletLedgerEntries,
  walletLedgerKindEnum,
} from "@ijf/database";
import { createLogger, serializeUnknownError } from "@ijf/shared/logger";
import { deriveSuiKeypair, getMasterMnemonic, getSponsorMnemonic } from "@ijf/shared/wallet";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { config } from "./config";
import { prepareSponsoredTransfer, selectSenderCoins, suiClient } from "./sui-coins";

export type WalletLedgerKind = (typeof walletLedgerKindEnum.enumValues)[number];
export type AccumulatedEntryKind = "fee" | "charge";

type AccumulatedSweepKindMap = {
  fee: "fee_sweep";
  charge: "charge_sweep";
};

export type AccumulatedSweepConfig<K extends AccumulatedEntryKind = AccumulatedEntryKind> = {
  entryKind: K;
  sweepKind: AccumulatedSweepKindMap[K];
  logName: string;
  label: string;
  targetWallet: string | undefined;
};

/** @deprecated Use {@link AccumulatedSweepConfig} */
export type SweepKindConfig = AccumulatedSweepConfig;

type SweepEntryMetadata = {
  sweptEntryIds?: string[];
};

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

const toSweepKind = <K extends AccumulatedEntryKind>(kind: K): AccumulatedSweepKindMap[K] =>
  `${kind}_sweep` as AccumulatedSweepKindMap[K];

const absNativeAmount = (amountNative: string): bigint => {
  const amount = BigInt(amountNative);
  return amount < 0n ? -amount : amount;
};

const loadSweptEntryIds = async (sweepKind: WalletLedgerKind): Promise<Set<string>> => {
  const sweepRows = await db
    .select({ metadata: walletLedgerEntries.metadata })
    .from(walletLedgerEntries)
    .where(
      and(
        eq(walletLedgerEntries.kind, sweepKind),
        eq(walletLedgerEntries.networkEnv, config.networkEnv),
        sql`${walletLedgerEntries.txHash} IS NOT NULL`,
      ),
    );

  const sweptEntryIds = new Set<string>();
  for (const row of sweepRows) {
    const metadata = row.metadata as SweepEntryMetadata | null;
    for (const entryId of metadata?.sweptEntryIds ?? []) {
      sweptEntryIds.add(entryId);
    }
  }

  return sweptEntryIds;
};

/**
 * Finds all ledger entries of the given kind that have not yet been swept.
 * An entry is considered swept when its id appears in `metadata.sweptEntryIds`
 * on a confirmed sweep ledger row. Only wallets whose aggregate meets the
 * sweep threshold are returned.
 */
export const findSweepableWallets = async (
  kind: AccumulatedEntryKind,
): Promise<WalletAggregate[]> => {
  const sweepKind = toSweepKind(kind);
  const sweptEntryIds = await loadSweptEntryIds(sweepKind);

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
    .where(
      and(
        eq(walletLedgerEntries.kind, kind),
        eq(walletLedgerEntries.networkEnv, config.networkEnv),
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
    if (sweptEntryIds.has(row.entryId)) {
      continue;
    }

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
    group.totalNative += absNativeAmount(row.amountNative);
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

export type InsertSweepEntryParams = {
  walletId: string;
  amountNative: bigint;
  txHash: string;
  targetAddress: string;
  sweptEntryIds: string[];
  kind: "fee_sweep" | "charge_sweep";
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
}: InsertSweepEntryParams): Promise<void> => {
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

export type ExecuteSponsoredTransferParams = {
  senderKeypair: Ed25519Keypair;
  senderAddress: string;
  sponsorKeypair: Ed25519Keypair;
  sponsorAddress: string;
  targetAddress: string;
  amount: bigint;
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
}: ExecuteSponsoredTransferParams): Promise<string> => {
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
export const sweepAccumulated = async <K extends AccumulatedEntryKind>(
  kindConfig: AccumulatedSweepConfig<K>,
): Promise<SweepResult> => {
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
  const sponsorAddress = sponsorKeypair.toSuiAddress();

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

    const walletLogCtx = {
      walletId: wallet.walletId,
      senderAddress,
      derivationIndex: wallet.derivationIndex,
      amountNative: wallet.totalNative.toString(),
      entryCount: wallet.entryIds.length,
    };

    if (senderAddress !== wallet.senderAddress) {
      errors += 1;
      log.error(`${label} sweep skipped: derived sender address mismatch`, {
        ...walletLogCtx,
        storedSenderAddress: wallet.senderAddress,
      });
      continue;
    }

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
