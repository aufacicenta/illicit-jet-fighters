import { createLogger } from "@ijf/shared/logger";

import { config } from "./config";

const log = createLogger("notify-topup");

export const notifyTopupRecorded = async ({
  walletId,
  txHash,
  amountMist,
  amountUsd,
}: {
  walletId: string;
  txHash: string;
  amountMist: bigint;
  amountUsd: number;
}) => {
  if (!config.apiBaseUrl || !config.walletIndexerSecret) {
    log.debug("skipping topup websocket notify (API_BASE_URL or WALLET_INDEXER_SECRET unset)", {
      walletId,
      txHash,
    });
    return;
  }

  const url = `${config.apiBaseUrl.replace(/\/$/, "")}/internal/wallet/topup`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.walletIndexerSecret}`,
      },
      body: JSON.stringify({
        walletId,
        txHash,
        amountMist: amountMist.toString(),
        amountUsd: amountUsd.toFixed(8),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      log.warn("topup websocket notify failed", {
        walletId,
        txHash,
        status: response.status,
        body: body.slice(0, 200),
      });
      return;
    }

    log.info("topup websocket notify sent", { walletId, txHash });
  } catch (error) {
    log.warn("topup websocket notify error", {
      walletId,
      txHash,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
