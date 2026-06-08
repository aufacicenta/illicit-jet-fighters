import { db, eq, userWallets } from "@ijf/database";
import { createLogger, serializeUnknownError, truncateAddress } from "@ijf/shared/logger";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

import { config } from "./config";
import { notifyTopupRecorded } from "./notify-topup";
import { recordTopup } from "./record-topup";

const log = createLogger("poll-sui");

const suiClient = new SuiJsonRpcClient({
  network: config.networkEnv,
  url: config.suiRpcUrl || getJsonRpcFullnodeUrl(config.networkEnv),
});

type BalanceChange = {
  owner?: { AddressOwner?: string };
  amount?: string;
  coinType?: string;
};

const isMissingCursorTransactionError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("Could not find the referenced transaction");
};

const parseIncomingNative = (
  changes: BalanceChange[] | undefined,
  targetAddress: string,
): bigint => {
  if (!changes?.length) {
    return 0n;
  }

  return changes.reduce((acc, change) => {
    if (change.coinType !== "0x2::sui::SUI") {
      return acc;
    }
    if (change.owner?.AddressOwner?.toLowerCase() !== targetAddress.toLowerCase()) {
      return acc;
    }
    if (!change.amount) {
      return acc;
    }

    const native = BigInt(change.amount);
    return native > 0n ? acc + native : acc;
  }, 0n);
};

export const pollSuiTopups = async () => {
  const startedAt = performance.now();

  const wallets = await db
    .select({
      id: userWallets.id,
      address: userWallets.address,
      topupCursor: userWallets.topupCursor,
      topupCursorCheckpoint: userWallets.topupCursorCheckpoint,
    })
    .from(userWallets)
    .where(eq(userWallets.network, "sui"));

  log.info("polling SUI topups", { walletCount: wallets.length });

  let topupsRecorded = 0;
  let topupsSkipped = 0;
  let blocksScanned = 0;

  for (const wallet of wallets) {
    try {
      let cursor = wallet.topupCursor ?? undefined;
      let hasMore = true;

      while (hasMore) {
        let txBlocks;

        try {
          txBlocks = await suiClient.queryTransactionBlocks({
            filter: { ToAddress: wallet.address },
            cursor,
            order: "ascending",
            options: {
              showBalanceChanges: true,
            },
          });
        } catch (error) {
          if (!cursor || !isMissingCursorTransactionError(error)) {
            throw error;
          }

          log.warn("resetting invalid topup cursor", {
            walletId: wallet.id,
            address: truncateAddress(wallet.address),
            previousCursor: cursor,
          });

          await db
            .update(userWallets)
            .set({
              topupCursor: null,
              topupCursorCheckpoint: null,
              updatedAt: new Date(),
            })
            .where(eq(userWallets.id, wallet.id));

          cursor = undefined;
          txBlocks = await suiClient.queryTransactionBlocks({
            filter: { ToAddress: wallet.address },
            order: "ascending",
            options: {
              showBalanceChanges: true,
            },
          });
        }

        blocksScanned += txBlocks.data.length;

        log.debug("queried wallet transactions", {
          walletId: wallet.id,
          address: truncateAddress(wallet.address),
          cursor: cursor ?? null,
          blockCount: txBlocks.data.length,
          hasNextPage: txBlocks.hasNextPage,
        });

        for (const block of txBlocks.data) {
          const digest = block.digest;
          if (!digest) {
            continue;
          }
          const amountNative = parseIncomingNative(
            (block.balanceChanges as BalanceChange[] | undefined) ?? [],
            wallet.address,
          );
          if (amountNative <= 0n) {
            continue;
          }

          log.info("incoming SUI topup detected", {
            walletId: wallet.id,
            address: truncateAddress(wallet.address),
            amountNative: amountNative.toString(),
            txHash: digest,
          });

          const recorded = await recordTopup({
            walletId: wallet.id,
            networkEnv: config.networkEnv,
            amountNative,
            txHash: digest,
          });

          if (recorded.inserted) {
            topupsRecorded += 1;
            await notifyTopupRecorded({
              walletId: wallet.id,
              txHash: digest,
              amountNative,
              amountUsd: recorded.amountUsdSnapshot,
            });
          } else {
            topupsSkipped += 1;
          }
        }

        if (txBlocks.nextCursor) {
          cursor = txBlocks.nextCursor;
          await db
            .update(userWallets)
            .set({
              topupCursor: txBlocks.nextCursor,
              topupCursorCheckpoint: wallet.topupCursorCheckpoint,
              updatedAt: new Date(),
            })
            .where(eq(userWallets.id, wallet.id));

          log.debug("advanced topup cursor", {
            walletId: wallet.id,
            address: truncateAddress(wallet.address),
            nextCursor: txBlocks.nextCursor,
          });
        }

        hasMore = txBlocks.hasNextPage === true;
      }
    } catch (error) {
      const details = serializeUnknownError(error);
      log.error("wallet poll failed", {
        walletId: wallet.id,
        address: truncateAddress(wallet.address),
        error: details.message ?? details.summary,
        errorDetails: details,
      });
    }
  }

  log.info("SUI topup poll completed", {
    walletCount: wallets.length,
    blocksScanned,
    topupsRecorded,
    topupsSkipped,
    durationMs: Math.round(performance.now() - startedAt),
  });
};
