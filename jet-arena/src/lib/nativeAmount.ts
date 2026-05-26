export const isPositiveIntegerString = (value: string) => /^\d+$/.test(value);

export const safeNativeBigInt = (value: string | bigint) => {
  if (typeof value === "bigint") {
    return value >= 0n ? value : 0n;
  }

  return isPositiveIntegerString(value) ? BigInt(value) : 0n;
};

export const parseTokenAmountToNative = (value: string, decimals: number): bigint | null => {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const [wholePart, fractionPartRaw = ""] = normalized.split(".");
  const safeDecimals = Number.isInteger(decimals) && decimals > 0 ? decimals : 0;
  if (fractionPartRaw.length > safeDecimals) {
    return null;
  }

  if (safeDecimals === 0) {
    return BigInt(wholePart);
  }

  const fractionPart = fractionPartRaw.padEnd(safeDecimals, "0");
  return BigInt(wholePart) * 10n ** BigInt(safeDecimals) + BigInt(fractionPart || "0");
};
