export const computeAvailableBalanceNative = (
  balanceNative: bigint,
  lockedBalanceNative: bigint,
): bigint => {
  const available = balanceNative - lockedBalanceNative;
  return available > 0n ? available : 0n;
};
