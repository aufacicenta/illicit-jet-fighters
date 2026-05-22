export type WalletNetwork = "sui";

export type WalletLedgerKind =
  | "topup"
  | "charge"
  | "fee"
  | "withdrawal_request"
  | "withdrawal_broadcast"
  | "withdrawal_confirm"
  | "withdrawal_refund"
  | "adjustment";

export type WalletBalanceSnapshot = {
  walletId: string;
  balanceMist: bigint;
  fxNativePerUsd: number;
  balanceUsd: number;
};

export type WithdrawalStatus = "pending" | "broadcasting" | "confirmed" | "refunded";

export type WithdrawalView = {
  groupId: string;
  targetAddress: string;
  amountMist: bigint;
  status: WithdrawalStatus;
  latestTxHash: string | null;
  requestedAt: Date;
  settledAt: Date | null;
  errorMessage: string | null;
};
