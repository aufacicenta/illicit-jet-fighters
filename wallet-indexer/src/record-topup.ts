import { db, sql } from "@ijf/database";
import type { NetworkEnvName } from "@ijf/shared";
import { createLogger } from "@ijf/shared/logger";

import { config } from "./config";
import { getSuiUsdPrice } from "./fx-snapshot";

const log = createLogger("record-topup", {
  walletNetwork: config.walletNetwork,
  networkEnv: config.networkEnv,
});

const NATIVE_BASE_UNITS_PER_SUI = 1_000_000_000;

export const recordTopup = async ({
  walletId,
  networkEnv,
  amountNative,
  txHash,
}: {
  walletId: string;
  networkEnv: NetworkEnvName;
  amountNative: bigint;
  txHash: string;
}) => {
  const suiUsd = await getSuiUsdPrice();
  const fxNativePerUsd = NATIVE_BASE_UNITS_PER_SUI / suiUsd;
  const amountUsdSnapshot = Number(amountNative) / fxNativePerUsd;

  log.info("recording topup", {
    walletId,
    amountNative: amountNative.toString(),
    amountUsdSnapshot: amountUsdSnapshot.toFixed(8),
    fxNativePerUsd: fxNativePerUsd.toFixed(12),
    suiUsd,
    txHash,
  });

  const result = await db.execute<{ wallet_id: string }>(sql`
    insert into wallet_ledger_entries (
      wallet_id,
      network_env,
      kind,
      amount_native,
      amount_usd_snapshot,
      fx_native_per_usd,
      tx_hash
    )
    values (
      ${walletId},
      ${networkEnv}::public.wallet_network_env,
      'topup',
      ${amountNative.toString()},
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
