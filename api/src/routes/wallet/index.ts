import { and, db, desc, eq, lt, not, sql, walletLedgerEntries } from "@ijf/database";
import { Elysia, t } from "elysia";

import { getOwnedFighter } from "../../lib/fighter-access";
import { requireBearerAuth } from "../../lib/require-bearer-auth";
import { buildWalletBalanceSnapshot } from "../../lib/wallet/charge";
import { getSuiUsdPrice } from "../../lib/wallet/fx";
import {
  appendFighterToUserTransfer,
  appendSimulationSettlement,
  appendUserToFighterTransfer,
  appendWithdrawalRefund,
  appendWithdrawalRequest,
  getFighterBalanceMist,
  getWalletBalanceMist,
  listFighterLedgerEntries,
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
        feeAmountNative: sql<string>`coalesce((
          select sum(f.amount_native)::text
          from wallet_ledger_entries f
          where f.parent_id = ${walletLedgerEntries.id}
            and f.kind = 'fee'
        ), '0')`,
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
                not(eq(walletLedgerEntries.kind, "fee")),
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
                not(eq(walletLedgerEntries.kind, "fee")),
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
  .get(
    "/me/fighters/:fighterId/ledger",
    async ({ params, query, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const network = getWalletNetwork();
      const networkEnv = getWalletNetworkEnv();
      const wallet = await ensureUserWallet({ userId: auth.userId, network });
      const fighterId = Number.parseInt(params.fighterId, 10);
      if (!Number.isInteger(fighterId) || fighterId <= 0) {
        return status(400, "Invalid fighterId.");
      }
      const limit = Math.max(1, Math.min(200, Number.parseInt(query.limit ?? "50", 10)));
      const ownedFighter = await getOwnedFighter(fighterId, auth.userId);
      if (!ownedFighter) {
        return status(404, "Fighter not found.");
      }
      try {
        const entries = await listFighterLedgerEntries({ fighterId, limit });
        const fighterBalanceMist = await getFighterBalanceMist(fighterId);
        const walletBalanceMist = await getWalletBalanceMist(wallet.id, networkEnv);
        return {
          fighterId,
          fighterBalanceMist: fighterBalanceMist.toString(),
          walletBalanceMist: walletBalanceMist.toString(),
          entries: entries.map((entry) => ({
            ...entry,
            createdAt: entry.createdAt.toISOString(),
          })),
        };
      } catch (error) {
        return status(
          400,
          error instanceof Error ? error.message : "Unable to fetch fighter ledger.",
        );
      }
    },
    {
      params: t.Object({
        fighterId: t.String(),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/me/fighters/:fighterId/transfer-in",
    async ({ params, body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const network = getWalletNetwork();
      const networkEnv = getWalletNetworkEnv();
      const wallet = await ensureUserWallet({ userId: auth.userId, network });
      const fighterId = Number.parseInt(params.fighterId, 10);
      if (!Number.isInteger(fighterId) || fighterId <= 0) {
        return status(400, "Invalid fighterId.");
      }
      const amountMist = parseMist(body.amountMist);
      if (!amountMist || amountMist <= 0n) {
        return status(400, "amountMist must be a positive integer string.");
      }
      const suiUsd = await getSuiUsdPrice();
      const fxNativePerUsd = MIST_PER_SUI / suiUsd;
      try {
        const transfer = await appendUserToFighterTransfer({
          walletId: wallet.id,
          userId: auth.userId,
          fighterId,
          networkEnv,
          amountMist,
          fxNativePerUsd,
        });
        return {
          fighterId,
          amountMist: amountMist.toString(),
          correlationId: transfer.correlationId,
          walletBalanceMist: transfer.walletBalanceMist.toString(),
          fighterBalanceMist: transfer.fighterBalanceMist.toString(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Transfer failed.";
        if (message.includes("not found")) {
          return status(404, message);
        }
        if (message.includes("Insufficient")) {
          return status(400, message);
        }
        return status(500, message);
      }
    },
    {
      params: t.Object({
        fighterId: t.String(),
      }),
      body: t.Object({
        amountMist: t.String(),
      }),
    },
  )
  .post(
    "/me/fighters/:fighterId/transfer-out",
    async ({ params, body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const network = getWalletNetwork();
      const networkEnv = getWalletNetworkEnv();
      const wallet = await ensureUserWallet({ userId: auth.userId, network });
      const fighterId = Number.parseInt(params.fighterId, 10);
      if (!Number.isInteger(fighterId) || fighterId <= 0) {
        return status(400, "Invalid fighterId.");
      }
      const amountMist = parseMist(body.amountMist);
      if (!amountMist || amountMist <= 0n) {
        return status(400, "amountMist must be a positive integer string.");
      }
      const suiUsd = await getSuiUsdPrice();
      const fxNativePerUsd = MIST_PER_SUI / suiUsd;
      try {
        const transfer = await appendFighterToUserTransfer({
          walletId: wallet.id,
          userId: auth.userId,
          fighterId,
          networkEnv,
          amountMist,
          fxNativePerUsd,
        });
        return {
          fighterId,
          amountMist: amountMist.toString(),
          correlationId: transfer.correlationId,
          walletBalanceMist: transfer.walletBalanceMist.toString(),
          fighterBalanceMist: transfer.fighterBalanceMist.toString(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Transfer failed.";
        if (message.includes("not found")) {
          return status(404, message);
        }
        if (message.includes("Insufficient")) {
          return status(400, message);
        }
        return status(500, message);
      }
    },
    {
      params: t.Object({
        fighterId: t.String(),
      }),
      body: t.Object({
        amountMist: t.String(),
      }),
    },
  )
  .post(
    "/me/fighters/settlement",
    async ({ body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const network = getWalletNetwork();
      const networkEnv = getWalletNetworkEnv();
      const wallet = await ensureUserWallet({ userId: auth.userId, network });
      const amountMist = parseMist(body.amountMist);
      if (!amountMist || amountMist <= 0n) {
        return status(400, "amountMist must be a positive integer string.");
      }
      const suiUsd = await getSuiUsdPrice();
      const fxNativePerUsd = MIST_PER_SUI / suiUsd;
      try {
        const settlement = await appendSimulationSettlement({
          losingOwnerUserId: auth.userId,
          losingOwnerWalletId: wallet.id,
          losingFighterId: body.losingFighterId,
          winningFighterId: body.winningFighterId,
          networkEnv,
          amountMist,
          fxNativePerUsd,
        });
        return {
          correlationId: settlement.correlationId,
          amountMist: amountMist.toString(),
          losingFighterId: body.losingFighterId,
          winningFighterId: body.winningFighterId,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Settlement failed.";
        if (message.includes("not found") || message.includes("valid fighters")) {
          return status(404, message);
        }
        if (message.includes("Insufficient")) {
          return status(400, message);
        }
        return status(500, message);
      }
    },
    {
      body: t.Object({
        losingFighterId: t.Number(),
        winningFighterId: t.Number(),
        amountMist: t.String(),
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
