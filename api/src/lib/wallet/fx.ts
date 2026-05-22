type FxSnapshot = {
  suiUsd: number;
  fetchedAt: number;
};

let cachedFx: FxSnapshot | null = null;
const FX_CACHE_MS = 60_000;

export const getSuiUsdPrice = async () => {
  const now = Date.now();
  if (cachedFx && now - cachedFx.fetchedAt < FX_CACHE_MS) {
    return cachedFx.suiUsd;
  }

  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd",
  );
  if (!response.ok) {
    throw new Error("Unable to fetch SUI/USD price.");
  }

  const payload = (await response.json()) as { sui?: { usd?: number } };
  const suiUsd = payload.sui?.usd;
  if (!suiUsd || !Number.isFinite(suiUsd) || suiUsd <= 0) {
    throw new Error("Invalid SUI/USD price response.");
  }

  cachedFx = { suiUsd, fetchedAt: now };
  return suiUsd;
};
