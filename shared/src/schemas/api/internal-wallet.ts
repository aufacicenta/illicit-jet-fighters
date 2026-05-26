import { z } from "zod";

export const walletTopupNotificationRequestSchema = z.object({
  walletId: z.string().min(1),
  txHash: z.string().min(1),
  amountNative: z.string().regex(/^\d+$/),
  amountUsd: z.string(),
});

export const walletTopupNotificationResponseSchema = z.object({
  ok: z.literal(true),
});

export type WalletTopupNotificationRequest = z.infer<typeof walletTopupNotificationRequestSchema>;
export type WalletTopupNotificationResponse = z.infer<typeof walletTopupNotificationResponseSchema>;
