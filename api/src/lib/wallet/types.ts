export type WalletNetwork = "sui";

export type WalletLedgerKind =
  | "topup"
  | "charge"
  | "fee"
  | "fighter_transfer_in"
  | "fighter_transfer_out"
  | "withdrawal_request"
  | "withdrawal_broadcast"
  | "withdrawal_confirm"
  | "withdrawal_refund"
  | "adjustment";

export type WalletBalanceSnapshot = {
  walletId: string;
  balanceNative: bigint;
  fxNativePerUsd: number;
  balanceUsd: number;
};

export type WithdrawalStatus = "pending" | "broadcasting" | "confirmed" | "refunded";

export type WithdrawalView = {
  groupId: string;
  targetAddress: string;
  amountNative: bigint;
  status: WithdrawalStatus;
  latestTxHash: string | null;
  requestedAt: Date;
  settledAt: Date | null;
  errorMessage: string | null;
};
