import { logger } from "../logger";

type FxSnapshot = {
  suiUsd: number;
  fetchedAt: number;
};

let cachedFx: FxSnapshot | null = null;
const FX_CACHE_MS = 60_000;

export const getSuiUsdPrice = async (): Promise<number | null> => {
  const now = Date.now();
  if (cachedFx && now - cachedFx.fetchedAt < FX_CACHE_MS) {
    return cachedFx.suiUsd;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd",
    );
    if (!response.ok) {
      throw new Error(`CoinGecko responded with ${response.status}`);
    }

    const payload = (await response.json()) as { sui?: { usd?: number } };
    const suiUsd = payload.sui?.usd;
    if (!suiUsd || !Number.isFinite(suiUsd) || suiUsd <= 0) {
      throw new Error("Invalid SUI/USD price in response payload.");
    }

    cachedFx = { suiUsd, fetchedAt: now };
    return suiUsd;
  } catch (error) {
    if (cachedFx) {
      logger.warn("SUI/USD price fetch failed, returning stale cached price", {
        staleSinceMs: now - cachedFx.fetchedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      return cachedFx.suiUsd;
    }

    logger.error("SUI/USD price fetch failed with no cached fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
