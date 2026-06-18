import { db, eq, userWallets, walletLedgerEntries } from "@ijf/database";
import { createLogger } from "@ijf/shared/logger";

import { config } from "./config";

const log = createLogger("reset-devnet", {
  walletNetwork: config.walletNetwork,
  networkEnv: config.networkEnv,
});

/**
 * Devnet wipes its on-chain state periodically, which leaves the persistent
 * Postgres ledger holding balances for addresses whose coins no longer exist.
 * This clears the ledger + topup cursors for the configured network env so the
 * indexer re-scans the fresh chain from scratch. Guarded so it can never nuke
 * testnet/mainnet ledger data by accident.
 */
const main = async () => {
  const networkEnv = config.networkEnv;
  const force = process.argv.includes("--force");

  if (networkEnv !== "devnet" && !force) {
    log.error("refusing to reset non-devnet ledger without --force", { networkEnv });
    process.exit(1);
  }

  log.warn("resetting wallet ledger state", { networkEnv, force });

  const deleted = await db
    .delete(walletLedgerEntries)
    .where(eq(walletLedgerEntries.networkEnv, networkEnv))
    .returning({ id: walletLedgerEntries.id });

  const cursorReset = await db
    .update(userWallets)
    .set({ topupCursor: null, topupCursorCheckpoint: null, updatedAt: new Date() })
    .where(eq(userWallets.network, "sui"))
    .returning({ id: userWallets.id });

  log.info("wallet ledger reset complete", {
    networkEnv,
    ledgerEntriesDeleted: deleted.length,
    walletsCursorReset: cursorReset.length,
  });

  process.exit(0);
};

main().catch((error) => {
  log.error("wallet ledger reset failed", { error });
  process.exit(1);
});
