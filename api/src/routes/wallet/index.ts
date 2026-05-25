import { and, db, desc, eq, lt, walletLedgerEntries } from "@ijf/database";
import { Elysia, t } from "elysia";

import { requireBearerAuth } from "../../lib/require-bearer-auth";
import { buildWalletBalanceSnapshot } from "../../lib/wallet/charge";
import { getSuiUsdPrice } from "../../lib/wallet/fx";
import {
  appendWithdrawalRefund,
  appendWithdrawalRequest,
  getWalletBalanceMist,
  listWithdrawals,
} from "../../lib/wallet/ledger";
import { getWalletNetwork, getWalletNetworkEnv } from "../../lib/wallet/wallet-config";
import { ensureUserWallet } from "../../lib/wallet/wallet-provision";
import { sendToUser } from "../../ws/store";

const MIST_PER_SUI = 1_000_000_000;

const parseMist = (value: string) => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  return BigInt(trimmed);
};

const isValidSuiAddress = (value: string) => /^0x[a-fA-F0-9]{40,64}$/.test(value.trim());

export const walletRoutes = new Elysia({ prefix: "/wallet" })
  .get("/me", async ({ request, headers }) => {
    const auth = await requireBearerAuth(request, headers);
    const network = getWalletNetwork();
    const networkEnv = getWalletNetworkEnv();
    const wallet = await ensureUserWallet({ userId: auth.userId, network });
    const suiUsd = await getSuiUsdPrice();
    const fxNativePerUsd = MIST_PER_SUI / suiUsd;
    const snapshot = await buildWalletBalanceSnapshot({
      walletId: wallet.id,
      networkEnv,
      fxNativePerUsd,
    });

    return {
      walletId: wallet.id,
      address: wallet.address,
      network: wallet.network,
      networkEnv,
      balanceMist: snapshot.balanceMist.toString(),
      balanceUsd: snapshot.balanceUsd.toFixed(8),
      fxNativePerUsd: snapshot.fxNativePerUsd.toFixed(12),
    };
  })
  .get(
    "/me/ledger",
    async ({ query, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const network = getWalletNetwork();
      const networkEnv = getWalletNetworkEnv();
      const wallet = await ensureUserWallet({ userId: auth.userId, network });
      const limit = Math.max(1, Math.min(200, Number.parseInt(query.limit ?? "50", 10)));
      const cursor = query.cursor ? new Date(query.cursor) : null;
      if (cursor && Number.isNaN(cursor.getTime())) {
        return status(400, "Invalid cursor.");
      }

      const baseQuery = {
        id: walletLedgerEntries.id,
        kind: walletLedgerEntries.kind,
        amountNative: walletLedgerEntries.amountNative,
        amountUsdSnapshot: walletLedgerEntries.amountUsdSnapshot,
        fxNativePerUsd: walletLedgerEntries.fxNativePerUsd,
        correlationId: walletLedgerEntries.correlationId,
        llmUsageEventId: walletLedgerEntries.llmUsageEventId,
        groupId: walletLedgerEntries.groupId,
        txHash: walletLedgerEntries.txHash,
        targetAddress: walletLedgerEntries.targetAddress,
        errorMessage: walletLedgerEntries.errorMessage,
        metadata: walletLedgerEntries.metadata,
        createdAt: walletLedgerEntries.createdAt,
      };

      const fetched = cursor
        ? await db
            .select(baseQuery)
            .from(walletLedgerEntries)
            .where(
              and(
                eq(walletLedgerEntries.walletId, wallet.id),
                eq(walletLedgerEntries.networkEnv, networkEnv),
                lt(walletLedgerEntries.createdAt, cursor),
              ),
            )
            .orderBy(desc(walletLedgerEntries.createdAt))
            .limit(limit)
        : await db
            .select(baseQuery)
            .from(walletLedgerEntries)
            .where(
              and(
                eq(walletLedgerEntries.walletId, wallet.id),
                eq(walletLedgerEntries.networkEnv, networkEnv),
              ),
            )
            .orderBy(desc(walletLedgerEntries.createdAt))
            .limit(limit);

      return {
        walletId: wallet.id,
        entries: fetched.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        })),
        nextCursor:
          fetched.length === limit
            ? (fetched[fetched.length - 1]?.createdAt.toISOString() ?? null)
            : null,
      };
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
      }),
    },
  )
  .get("/me/withdrawals", async ({ request, headers }) => {
    const auth = await requireBearerAuth(request, headers);
    const network = getWalletNetwork();
    const networkEnv = getWalletNetworkEnv();
    const wallet = await ensureUserWallet({ userId: auth.userId, network });
    const withdrawals = await listWithdrawals(wallet.id, networkEnv);

    return {
      walletId: wallet.id,
      withdrawals: withdrawals.map((withdrawal) => ({
        ...withdrawal,
        amountMist: withdrawal.amountMist.toString(),
        requestedAt: withdrawal.requestedAt.toISOString(),
        settledAt: withdrawal.settledAt?.toISOString() ?? null,
      })),
    };
  })
  .post(
    "/me/withdrawals",
    async ({ body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const network = getWalletNetwork();
      const networkEnv = getWalletNetworkEnv();
      const wallet = await ensureUserWallet({ userId: auth.userId, network });
      const amountMist = parseMist(body.amountMist);
      if (!amountMist || amountMist <= 0n) {
        return status(400, "amountMist must be a positive integer string.");
      }
      if (!isValidSuiAddress(body.targetAddress)) {
        return status(400, "Invalid SUI address.");
      }

      const currentBalanceMist = await getWalletBalanceMist(wallet.id, networkEnv);
      if (currentBalanceMist < amountMist) {
        return status(400, "Insufficient wallet balance.");
      }

      const suiUsd = await getSuiUsdPrice();
      const fxNativePerUsd = MIST_PER_SUI / suiUsd;
      const amountUsdSnapshot = Number(amountMist) / fxNativePerUsd;
      const groupId = await appendWithdrawalRequest({
        walletId: wallet.id,
        networkEnv,
        targetAddress: body.targetAddress,
        amountMist,
        amountUsdSnapshot,
        fxNativePerUsd,
      });

      const balance = await buildWalletBalanceSnapshot({
        walletId: wallet.id,
        networkEnv,
        fxNativePerUsd,
      });
      sendToUser(auth.userId, {
        type: "wallet:balance-update",
        walletId: wallet.id,
        networkEnv,
        balanceMist: balance.balanceMist.toString(),
        balanceUsd: balance.balanceUsd.toFixed(8),
        fxNativePerUsd: balance.fxNativePerUsd.toFixed(12),
        at: new Date().toISOString(),
      });
      sendToUser(auth.userId, {
        type: "wallet:withdrawal-update",
        groupId,
        status: "pending",
        at: new Date().toISOString(),
      });

      return {
        walletId: wallet.id,
        groupId,
        amountMist: amountMist.toString(),
        targetAddress: body.targetAddress,
        status: "pending" as const,
      };
    },
    {
      body: t.Object({
        targetAddress: t.String(),
        amountMist: t.String(),
      }),
    },
  )
  .post(
    "/me/withdrawals/:groupId/cancel",
    async ({ params, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const network = getWalletNetwork();
      const networkEnv = getWalletNetworkEnv();
      const wallet = await ensureUserWallet({ userId: auth.userId, network });
      const withdrawals = await listWithdrawals(wallet.id, networkEnv);
      const target = withdrawals.find((withdrawal) => withdrawal.groupId === params.groupId);
      if (!target) {
        return status(404, "Withdrawal group not found.");
      }
      if (target.status !== "pending") {
        return status(409, "Withdrawal can only be cancelled while pending.");
      }

      await appendWithdrawalRefund({
        walletId: wallet.id,
        networkEnv,
        groupId: params.groupId,
        errorMessage: "cancelled by user",
      });

      const suiUsd = await getSuiUsdPrice();
      const fxNativePerUsd = MIST_PER_SUI / suiUsd;
      const balance = await buildWalletBalanceSnapshot({
        walletId: wallet.id,
        networkEnv,
        fxNativePerUsd,
      });
      sendToUser(auth.userId, {
        type: "wallet:balance-update",
        walletId: wallet.id,
        networkEnv,
        balanceMist: balance.balanceMist.toString(),
        balanceUsd: balance.balanceUsd.toFixed(8),
        fxNativePerUsd: balance.fxNativePerUsd.toFixed(12),
        at: new Date().toISOString(),
      });
      sendToUser(auth.userId, {
        type: "wallet:withdrawal-update",
        groupId: params.groupId,
        status: "refunded",
        errorMessage: "cancelled by user",
        at: new Date().toISOString(),
      });

      return { status: "cancelled" as const, groupId: params.groupId };
    },
    {
      params: t.Object({
        groupId: t.String(),
      }),
    },
  );
