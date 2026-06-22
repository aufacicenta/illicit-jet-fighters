import { safeNativeBigInt } from "./nativeAmount";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export const formatUsd = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return usdFormatter.format(0);
  }

  const numericValue = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numericValue)) {
    return usdFormatter.format(0);
  }

  return usdFormatter.format(numericValue);
};

export const formatUsdAndNativeEquivalent = ({
  usdValue,
  nativeValue,
  nativeSymbol,
}: {
  usdValue: string | number | null | undefined;
  nativeValue: string | bigint;
  nativeSymbol: string;
}) => `${formatUsd(usdValue)} · ${safeNativeBigInt(nativeValue).toString()} ${nativeSymbol}`;
