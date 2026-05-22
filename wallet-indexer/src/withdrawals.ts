import { and, db, desc, eq, inArray, walletLedgerEntries, userWallets } from "@ijf/database";
import { createLogger, serializeUnknownError } from "@ijf/shared/logger";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { config } from "./config";

const log = createLogger("withdrawals");

const suiClient = new SuiJsonRpcClient({
  network: config.suiNetwork,
  url: config.suiRpcUrl || getJsonRpcFullnodeUrl(config.suiNetwork),
});

type PendingWithdrawal = {
  groupId: string;
  walletId: string;
  derivationIndex: number;
  targetAddress: string;
  amountMist: bigint;
};

const getDerivationPath = (index: number) => `m/44'/784'/${index}'/0'/0'`;

const getWalletKeypair = (derivationIndex: number) => {
  const mnemonic = config.walletMasterMnemonic;
  if (!mnemonic) {
    throw new Error("WALLET_MASTER_MNEMONIC is required.");
  }
  return Ed25519Keypair.deriveKeypair(mnemonic, getDerivationPath(derivationIndex));
};

const appendLifecycleRow = async ({
  walletId,
  groupId,
  kind,
  txHash,
  errorMessage,
  amountMist,
}: {
  walletId: string;
  groupId: string;
  kind: "withdrawal_broadcast" | "withdrawal_confirm" | "withdrawal_refund";
  txHash?: string;
  errorMessage?: string;
  amountMist?: bigint;
}) =>
  db.insert(walletLedgerEntries).values({
    walletId,
    kind,
    amountNative: (amountMist ?? 0n).toString(),
    amountUsdSnapshot: "0",
    fxNativePerUsd: "0",
    groupId,
    txHash: txHash ?? null,
    errorMessage: errorMessage ?? null,
  });

const findPendingWithdrawals = async (): Promise<PendingWithdrawal[]> => {
  const requests = await db
    .select({
      groupId: walletLedgerEntries.groupId,
      walletId: walletLedgerEntries.walletId,
      amountNative: walletLedgerEntries.amountNative,
      targetAddress: walletLedgerEntries.targetAddress,
      createdAt: walletLedgerEntries.createdAt,
    })
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.kind, "withdrawal_request"))
    .orderBy(desc(walletLedgerEntries.createdAt));

  const groupIds = requests
    .map((row) => row.groupId)
    .filter((groupId): groupId is string => Boolean(groupId));
  if (groupIds.length === 0) {
    return [];
  }

  const lifecycleRows = await db
    .select({
      groupId: walletLedgerEntries.groupId,
      kind: walletLedgerEntries.kind,
    })
    .from(walletLedgerEntries)
    .where(
      and(
        inArray(walletLedgerEntries.groupId, groupIds),
        inArray(walletLedgerEntries.kind, [
          "withdrawal_broadcast",
          "withdrawal_confirm",
          "withdrawal_refund",
        ]),
      ),
    );
  const blockedGroups = new Set(lifecycleRows.map((row) => row.groupId).filter(Boolean));

  const walletRows = await db
    .select({
      id: userWallets.id,
      derivationIndex: userWallets.derivationIndex,
    })
    .from(userWallets)
    .where(
      inArray(
        userWallets.id,
        requests.map((row) => row.walletId),
      ),
    );
  const derivationByWalletId = new Map(walletRows.map((row) => [row.id, row.derivationIndex]));

  return requests
    .filter((row) => row.groupId && row.targetAddress && !blockedGroups.has(row.groupId))
    .map((row) => ({
      groupId: row.groupId as string,
      walletId: row.walletId,
      derivationIndex: derivationByWalletId.get(row.walletId) ?? -1,
      targetAddress: row.targetAddress as string,
      amountMist: BigInt(row.amountNative.replace("-", "")),
    }))
    .filter((row) => row.derivationIndex >= 0);
};

export const processPendingWithdrawals = async () => {
  const startedAt = performance.now();
  const pending = await findPendingWithdrawals();

  log.info("processing pending withdrawals", { pendingCount: pending.length });

  let broadcast = 0;
  let confirmed = 0;
  let refunded = 0;

  for (const withdrawal of pending) {
    log.info("broadcasting withdrawal", {
      groupId: withdrawal.groupId,
      walletId: withdrawal.walletId,
      derivationIndex: withdrawal.derivationIndex,
      amountMist: withdrawal.amountMist.toString(),
      targetAddress: withdrawal.targetAddress,
    });

    try {
      const keypair = getWalletKeypair(withdrawal.derivationIndex);
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(withdrawal.amountMist)]);
      tx.transferObjects([coin], tx.pure.address(withdrawal.targetAddress));
      const executed = await suiClient.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: {
          showEffects: true,
        },
      });

      const txHash = executed.digest;
      if (!txHash) {
        throw new Error("Missing SUI transaction digest.");
      }

      await appendLifecycleRow({
        walletId: withdrawal.walletId,
        groupId: withdrawal.groupId,
        kind: "withdrawal_broadcast",
        txHash,
      });
      broadcast += 1;

      log.info("withdrawal broadcast", {
        groupId: withdrawal.groupId,
        walletId: withdrawal.walletId,
        txHash,
      });

      const confirmedTx = await suiClient.waitForTransaction({
        digest: txHash,
      });
      const status = confirmedTx.effects?.status?.status;
      if (status === "success") {
        await appendLifecycleRow({
          walletId: withdrawal.walletId,
          groupId: withdrawal.groupId,
          kind: "withdrawal_confirm",
          txHash,
        });
        confirmed += 1;

        log.info("withdrawal confirmed", {
          groupId: withdrawal.groupId,
          walletId: withdrawal.walletId,
          txHash,
        });
      } else {
        const errorMessage = confirmedTx.effects?.status?.error ?? "transaction failed";
        await appendLifecycleRow({
          walletId: withdrawal.walletId,
          groupId: withdrawal.groupId,
          kind: "withdrawal_refund",
          amountMist: withdrawal.amountMist,
          errorMessage,
        });
        refunded += 1;

        log.warn("withdrawal failed on-chain, refund recorded", {
          groupId: withdrawal.groupId,
          walletId: withdrawal.walletId,
          txHash,
          status,
          errorMessage,
        });
      }
    } catch (error) {
      const details = serializeUnknownError(error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      await appendLifecycleRow({
        walletId: withdrawal.walletId,
        groupId: withdrawal.groupId,
        kind: "withdrawal_refund",
        amountMist: withdrawal.amountMist,
        errorMessage,
      });
      refunded += 1;

      log.error("withdrawal processing failed, refund recorded", {
        groupId: withdrawal.groupId,
        walletId: withdrawal.walletId,
        error: details.message ?? details.summary,
        errorDetails: details,
      });
    }
  }

  log.info("withdrawal processing completed", {
    pendingCount: pending.length,
    broadcast,
    confirmed,
    refunded,
    durationMs: Math.round(performance.now() - startedAt),
  });
};
