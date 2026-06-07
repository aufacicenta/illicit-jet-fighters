import { computeAvailableBalanceNative } from "@ijf/shared";

import { safeNativeBigInt } from "./nativeAmount";

export const computeAvailableBalanceNativeFromStrings = (
  balanceNative: string,
  lockedBalanceNative: string,
): string =>
  computeAvailableBalanceNative(
    safeNativeBigInt(balanceNative),
    safeNativeBigInt(lockedBalanceNative),
  ).toString();
