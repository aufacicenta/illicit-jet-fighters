import { z } from "zod";

import { NETWORK_ENV_NAMES } from "../../sui-network";

export const walletSnapshotSchema = z.object({
  walletId: z.string(),
  address: z.string(),
  network: z.literal("sui"),
  currency: z
    .object({
      symbol: z.string(),
      nativeSymbol: z.string(),
      nativeDecimals: z.number(),
    })
    .optional(),
  networkEnv: z.enum(NETWORK_ENV_NAMES),
  balanceNative: z.string(),
  balanceUsd: z.string(),
  fxNativePerUsd: z.string(),
});

export const walletLedgerEntrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  amountNative: z.string(),
  amountUsdSnapshot: z.string().nullable(),
  fxNativePerUsd: z.string().nullable(),
  correlationId: z.string().nullable(),
  llmUsageEventId: z.string().nullable(),
  groupId: z.string().nullable(),
  txHash: z.string().nullable(),
  targetAddress: z.string().nullable(),
  errorMessage: z.string().nullable(),
  metadata: z.unknown(),
  feeAmountNative: z.string(),
  createdAt: z.string().datetime(),
});

export const walletLedgerSnapshotSchema = z.object({
  walletId: z.string(),
  entries: z.array(walletLedgerEntrySchema),
  nextCursor: z.string().datetime().nullable(),
});

export const walletAmountNativeRequestSchema = z.object({
  amountNative: z.string().regex(/^\d+$/),
});

export const walletFighterTransferSnapshotSchema = z.object({
  fighterId: z.number().int().positive(),
  amountNative: z.string(),
  correlationId: z.string().min(1),
  walletBalanceNative: z.string(),
  fighterBalanceNative: z.string(),
});

export const walletSettlementRequestSchema = z.object({
  losingFighterId: z.number().int().positive(),
  winningFighterId: z.number().int().positive(),
  amountNative: z.string().regex(/^\d+$/),
});

export const walletSettlementSnapshotSchema = z.object({
  correlationId: z.string().min(1),
  amountNative: z.string(),
  losingFighterId: z.number().int().positive(),
  winningFighterId: z.number().int().positive(),
});

export const walletWithdrawalStatusSchema = z.enum([
  "pending",
  "broadcasting",
  "confirmed",
  "refunded",
]);

export const walletWithdrawalSnapshotSchema = z.object({
  groupId: z.string(),
  targetAddress: z.string(),
  amountNative: z.string(),
  status: walletWithdrawalStatusSchema,
  latestTxHash: z.string().nullable(),
  requestedAt: z.string().datetime(),
  settledAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
});

export const walletWithdrawalsSnapshotSchema = z.object({
  walletId: z.string(),
  withdrawals: z.array(walletWithdrawalSnapshotSchema),
});

export const walletWithdrawalRequestSchema = z.object({
  targetAddress: z.string().trim().min(1),
  amountNative: z.string().regex(/^\d+$/),
});

export const walletWithdrawalRequestResponseSchema = z.object({
  walletId: z.string(),
  groupId: z.string(),
  amountNative: z.string(),
  targetAddress: z.string(),
  status: z.literal("pending"),
});

export const walletWithdrawalCancelResponseSchema = z.object({
  status: z.literal("cancelled"),
  groupId: z.string(),
});

export type WalletSnapshot = z.infer<typeof walletSnapshotSchema>;
export type WalletLedgerEntry = z.infer<typeof walletLedgerEntrySchema>;
export type WalletLedgerSnapshot = z.infer<typeof walletLedgerSnapshotSchema>;
export type WalletAmountNativeRequest = z.infer<typeof walletAmountNativeRequestSchema>;
export type WalletFighterTransferSnapshot = z.infer<typeof walletFighterTransferSnapshotSchema>;
export type WalletSettlementRequest = z.infer<typeof walletSettlementRequestSchema>;
export type WalletSettlementSnapshot = z.infer<typeof walletSettlementSnapshotSchema>;
export type WalletWithdrawalStatus = z.infer<typeof walletWithdrawalStatusSchema>;
export type WalletWithdrawalSnapshot = z.infer<typeof walletWithdrawalSnapshotSchema>;
export type WalletWithdrawalsSnapshot = z.infer<typeof walletWithdrawalsSnapshotSchema>;
export type WalletWithdrawalRequest = z.infer<typeof walletWithdrawalRequestSchema>;
export type WalletWithdrawalRequestResponse = z.infer<typeof walletWithdrawalRequestResponseSchema>;
export type WalletWithdrawalCancelResponse = z.infer<typeof walletWithdrawalCancelResponseSchema>;
