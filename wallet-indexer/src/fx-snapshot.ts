import { createLogger } from "@ijf/shared/logger";

const log = createLogger("fx-snapshot");

let cachedFx: { suiUsd: number; fetchedAt: number } | null = null;

export const getSuiUsdPrice = async () => {
  const now = Date.now();
  if (cachedFx && now - cachedFx.fetchedAt < 60_000) {
    log.debug("using cached SUI/USD price", {
      suiUsd: cachedFx.suiUsd,
      ageMs: now - cachedFx.fetchedAt,
    });
    return cachedFx.suiUsd;
  }

  log.info("fetching SUI/USD price from CoinGecko");

  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd",
  );
  if (!response.ok) {
    log.error("CoinGecko request failed", { status: response.status });
    throw new Error(`CoinGecko request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { sui?: { usd?: number } };
  const suiUsd = payload.sui?.usd;
  if (!suiUsd || !Number.isFinite(suiUsd) || suiUsd <= 0) {
    log.error("invalid SUI/USD payload from CoinGecko", { payload });
    throw new Error("Invalid SUI/USD payload from CoinGecko.");
  }

  cachedFx = { suiUsd, fetchedAt: now };
  log.info("SUI/USD price updated", { suiUsd });
  return suiUsd;
};
