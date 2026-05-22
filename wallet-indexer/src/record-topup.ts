import { db, sql } from "@ijf/database";
import { createLogger } from "@ijf/shared/logger";

import { getSuiUsdPrice } from "./fx-snapshot";

const log = createLogger("record-topup");

const MIST_PER_SUI = 1_000_000_000;

export const recordTopup = async ({
  walletId,
  amountMist,
  txHash,
}: {
  walletId: string;
  amountMist: bigint;
  txHash: string;
}) => {
  const suiUsd = await getSuiUsdPrice();
  const fxNativePerUsd = MIST_PER_SUI / suiUsd;
  const amountUsdSnapshot = Number(amountMist) / fxNativePerUsd;

  log.info("recording topup", {
    walletId,
    amountMist: amountMist.toString(),
    amountUsdSnapshot: amountUsdSnapshot.toFixed(8),
    fxNativePerUsd: fxNativePerUsd.toFixed(12),
    suiUsd,
    txHash,
  });

  const result = await db.execute<{ wallet_id: string }>(sql`
    insert into wallet_ledger_entries (
      wallet_id,
      kind,
      amount_native,
      amount_usd_snapshot,
      fx_native_per_usd,
      tx_hash
    )
    values (
      ${walletId},
      'topup',
      ${amountMist.toString()},
      ${amountUsdSnapshot.toFixed(8)},
      ${fxNativePerUsd.toFixed(12)},
      ${txHash}
    )
    on conflict do nothing
    returning wallet_id
  `);

  const inserted = result.rows.length > 0;
  if (inserted) {
    log.info("topup recorded", { walletId, txHash });
  } else {
    log.debug("topup skipped (duplicate tx)", { walletId, txHash });
  }

  return { inserted, amountUsdSnapshot };
};
