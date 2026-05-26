import { safeNativeBigInt } from "./nativeAmount";

type FormatTokenAmountFromNativeOptions = {
  fractionDigits?: number;
  trimTrailingZeros?: boolean;
};

export const formatTokenAmountFromNative = (
  nativeAmount: bigint | string,
  nativeDecimals: number,
  { fractionDigits = 4, trimTrailingZeros = false }: FormatTokenAmountFromNativeOptions = {},
) => {
  const normalizedNative = safeNativeBigInt(nativeAmount);
  const safeNativeDecimals =
    Number.isInteger(nativeDecimals) && nativeDecimals > 0 ? nativeDecimals : 0;
  if (safeNativeDecimals === 0) {
    return normalizedNative.toString();
  }

  const safeFractionDigits = Math.max(0, Math.min(fractionDigits, safeNativeDecimals));
  if (safeFractionDigits === 0) {
    return (normalizedNative / 10n ** BigInt(safeNativeDecimals)).toString();
  }

  const nativeFactor = 10n ** BigInt(safeNativeDecimals);
  const whole = normalizedNative / nativeFactor;
  const remainder = (normalizedNative % nativeFactor)
    .toString()
    .padStart(safeNativeDecimals, "0")
    .slice(0, safeFractionDigits);
  const fraction = trimTrailingZeros ? remainder.replace(/0+$/, "") : remainder;

  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
};
