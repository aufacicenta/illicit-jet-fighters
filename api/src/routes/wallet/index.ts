import { and, db, desc, eq, lt, not, sql, walletLedgerEntries } from "@ijf/database";
import {
  fighterArenaUnlockRequestSchema,
  fighterArenaUnlockResponseSchema,
  fighterLedgerPathParamsSchema,
  fighterLedgerSnapshotSchema,
  getWalletCurrencyMetadata,
  limitQuerySchema,
  walletAmountNativeRequestSchema,
  walletFighterTransferSnapshotSchema,
  walletLedgerQuerySchema,
  walletLedgerSnapshotSchema,
  walletSectionPreflightQuerySchema,
  walletSectionPreflightResponseSchema,
  walletSettlementRequestSchema,
  walletSettlementSnapshotSchema,
  walletSnapshotSchema,
  walletWithdrawalCancelResponseSchema,
  walletWithdrawalRequestResponseSchema,
  walletWithdrawalRequestSchema,
  walletWithdrawalsSnapshotSchema,
  withdrawalGroupPathParamsSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import {
  buildFighterBalanceSnapshot,
  getFighterAvailableBalanceNative,
  manualUnlockFighterStake,
} from "../../lib/arena/balance-lock";
import { getOwnedFighter } from "../../lib/fighter-access";
import { requireBearerAuth } from "../../lib/require-bearer-auth";
import { buildWalletBalanceSnapshot } from "../../lib/wallet/charge";
import {
  appendFighterToUserTransfer,
  appendSimulationSettlement,
  appendUserToFighterTransfer,
  appendWithdrawalRefund,
  appendWithdrawalRequest,
  getWalletBalanceNative,
  listFighterLedgerEntries,
  listWithdrawals,
} from "../../lib/wallet/ledger";
import { getPreflightBalanceSnapshot } from "../../lib/wallet/preflight";
import { resolveFxNativePerUsd } from "../../lib/wallet/resolve-fx";
import { getWalletNetwork, getWalletNetworkEnv } from "../../lib/wallet/wallet-config";
import { ensureUserWallet } from "../../lib/wallet/wallet-provision";
import { sendToUser } from "../../ws/store";

const parseNativeAmount = (value: string) => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  return BigInt(trimmed);
};

const isValidSuiAddress = (value: string) => /^0x[a-fA-F0-9]{40,64}$/.test(value.trim());

export const walletRoutes = new Elysia({ prefix: "/wallet" })
  .get(
    "/me",
    async ({ request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const network = getWalletNetwork();
      const networkEnv = getWalletNetworkEnv();
      const wallet = await ensureUserWallet({ userId: auth.userId, network });
      const fxNativePerUsd = await resolveFxNativePerUsd(network, { networkEnv });

      if (fxNativePerUsd === null) {
        const balance = await getWalletBalanceNative(wallet.id, networkEnv);
        return {
          walletId: wallet.id,
          address: wallet.address,
          network: wallet.network,
          currency: getWalletCurrencyMetadata(wallet.network),
          networkEnv,
          balanceNative: balance.toString(),
          balanceUsd: null,
          fxNativePerUsd: null,
        };
      }

      const snapshot = await buildWalletBalanceSnapshot({
        walletId: wallet.id,
        networkEnv,
        fxNativePerUsd,
      });

      return {
        walletId: wallet.id,
        address: wallet.address,
        network: wallet.network,
        currency: getWalletCurrencyMetadata(wallet.network),
        networkEnv,
        balanceNative: snapshot.balanceNative.toString(),
        balanceUsd: snapshot.balanceUsd.toFixed(8),
        fxNativePerUsd: snapshot.fxNativePerUsd.toFixed(12),
      };
    },
    {
      response: {
        200: walletSnapshotSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .get(
    "/me/preflight",
    async ({ query, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const parsed = walletSectionPreflightQuerySchema.safeParse(query);
      if (!parsed.success) {
        return status(400, "Invalid sectionId.");
      }

      const snapshot = await getPreflightBalanceSnapshot({
        userId: auth.userId,
        sectionId: parsed.data.sectionId,
      });

      return walletSectionPreflightResponseSchema.parse(snapshot);
    },
    {
      query: walletSectionPreflightQuerySchema,
      response: {
        200: walletSectionPreflightResponseSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
      },
    },
  )
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
      query: walletLedgerQuerySchema,
      response: {
        200: walletLedgerSnapshotSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
      },
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
        const walletBalanceNative = await getWalletBalanceNative(wallet.id, networkEnv);
        const balanceSnapshot = await buildFighterBalanceSnapshot(fighterId);
        return {
          fighterId,
          fighterBalanceNative: balanceSnapshot.fighterBalanceNative.toString(),
          lockedBalanceNative: balanceSnapshot.lockedBalanceNative.toString(),
          availableBalanceNative: balanceSnapshot.availableBalanceNative.toString(),
          walletBalanceNative: walletBalanceNative.toString(),
          openArenaLocks: balanceSnapshot.openArenaLocks.map((lock) => ({
            correlationId: lock.correlationId,
            lockedAmountNative: lock.lockedAmountNative.toString(),
            poolId: lock.poolId,
          })),
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
      params: fighterLedgerPathParamsSchema,
      query: limitQuerySchema,
      response: {
        200: fighterLedgerSnapshotSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
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
      const amountNative = parseNativeAmount(body.amountNative);
      if (!amountNative || amountNative <= 0n) {
        return status(400, "amountNative must be a positive integer string.");
      }
      const fxNativePerUsd = await resolveFxNativePerUsd(network, { networkEnv });
      if (fxNativePerUsd === null) {
        return status(503, "Price feed temporarily unavailable. Try again shortly.");
      }
      try {
        const transfer = await appendUserToFighterTransfer({
          walletId: wallet.id,
          userId: auth.userId,
          fighterId,
          networkEnv,
          amountNative,
          fxNativePerUsd,
        });
        return {
          fighterId,
          amountNative: amountNative.toString(),
          correlationId: transfer.correlationId,
          walletBalanceNative: transfer.walletBalanceNative.toString(),
          fighterBalanceNative: transfer.fighterBalanceNative.toString(),
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
      params: fighterLedgerPathParamsSchema,
      body: walletAmountNativeRequestSchema,
      response: {
        200: walletFighterTransferSnapshotSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
        404: t.String(),
        500: t.String(),
        503: t.String(),
      },
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
      const amountNative = parseNativeAmount(body.amountNative);
      if (!amountNative || amountNative <= 0n) {
        return status(400, "amountNative must be a positive integer string.");
      }
      const fxNativePerUsd = await resolveFxNativePerUsd(network, { networkEnv });
      if (fxNativePerUsd === null) {
        return status(503, "Price feed temporarily unavailable. Try again shortly.");
      }
      try {
        const availableBalanceNative = await getFighterAvailableBalanceNative(fighterId);
        if (amountNative > availableBalanceNative) {
          return status(400, "Insufficient unlocked fighter balance.");
        }
        const transfer = await appendFighterToUserTransfer({
          walletId: wallet.id,
          userId: auth.userId,
          fighterId,
          networkEnv,
          amountNative,
          fxNativePerUsd,
        });
        return {
          fighterId,
          amountNative: amountNative.toString(),
          correlationId: transfer.correlationId,
          walletBalanceNative: transfer.walletBalanceNative.toString(),
          fighterBalanceNative: transfer.fighterBalanceNative.toString(),
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
      params: fighterLedgerPathParamsSchema,
      body: walletAmountNativeRequestSchema,
      response: {
        200: walletFighterTransferSnapshotSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
        404: t.String(),
        500: t.String(),
        503: t.String(),
      },
    },
  )
  .post(
    "/me/fighters/:fighterId/unlock",
    async ({ params, body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const fighterId = Number.parseInt(params.fighterId, 10);
      if (!Number.isInteger(fighterId) || fighterId <= 0) {
        return status(400, "Invalid fighterId.");
      }
      try {
        const result = await manualUnlockFighterStake({
          fighterId,
          userId: auth.userId,
          correlationId: body.correlationId,
        });
        return {
          fighterId,
          correlationId: result.correlationId,
          unlockedAmountNative: result.unlockedAmountNative.toString(),
          fighterBalanceNative: result.fighterBalanceNative.toString(),
          lockedBalanceNative: result.lockedBalanceNative.toString(),
          availableBalanceNative: result.availableBalanceNative.toString(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to unlock arena stake.";
        if (message.includes("not found")) {
          return status(404, message);
        }
        if (
          message.includes("No open arena lock") ||
          message.includes("must be idle") ||
          message.includes("Leave the arena queue")
        ) {
          return status(400, message);
        }
        return status(500, message);
      }
    },
    {
      params: fighterLedgerPathParamsSchema,
      body: fighterArenaUnlockRequestSchema,
      response: {
        200: fighterArenaUnlockResponseSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
        404: t.String(),
        500: t.String(),
      },
    },
  )
  .post(
    "/me/fighters/settlement",
    async ({ body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const network = getWalletNetwork();
      const networkEnv = getWalletNetworkEnv();
      const wallet = await ensureUserWallet({ userId: auth.userId, network });
      const amountNative = parseNativeAmount(body.amountNative);
      if (!amountNative || amountNative <= 0n) {
        return status(400, "amountNative must be a positive integer string.");
      }
      const fxNativePerUsd = await resolveFxNativePerUsd(network, { networkEnv });
      if (fxNativePerUsd === null) {
        return status(503, "Price feed temporarily unavailable. Try again shortly.");
      }
      try {
        const settlement = await appendSimulationSettlement({
          losingOwnerUserId: auth.userId,
          losingOwnerWalletId: wallet.id,
          losingFighterId: body.losingFighterId,
          winningFighterId: body.winningFighterId,
          networkEnv,
          amountNative,
          fxNativePerUsd,
        });
        return {
          correlationId: settlement.correlationId,
          amountNative: amountNative.toString(),
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
      body: walletSettlementRequestSchema,
      response: {
        200: walletSettlementSnapshotSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
        404: t.String(),
        500: t.String(),
        503: t.String(),
      },
    },
  )
  .get(
    "/me/withdrawals",
    async ({ request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const network = getWalletNetwork();
      const networkEnv = getWalletNetworkEnv();
      const wallet = await ensureUserWallet({ userId: auth.userId, network });
      const withdrawals = await listWithdrawals(wallet.id, networkEnv);

      return {
        walletId: wallet.id,
        withdrawals: withdrawals.map((withdrawal) => ({
          ...withdrawal,
          amountNative: withdrawal.amountNative.toString(),
          requestedAt: withdrawal.requestedAt.toISOString(),
          settledAt: withdrawal.settledAt?.toISOString() ?? null,
        })),
      };
    },
    {
      response: {
        200: walletWithdrawalsSnapshotSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .post(
    "/me/withdrawals",
    async ({ body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const network = getWalletNetwork();
      const networkEnv = getWalletNetworkEnv();
      const wallet = await ensureUserWallet({ userId: auth.userId, network });
      const amountNative = parseNativeAmount(body.amountNative);
      if (!amountNative || amountNative <= 0n) {
        return status(400, "amountNative must be a positive integer string.");
      }
      if (!isValidSuiAddress(body.targetAddress)) {
        return status(400, "Invalid SUI address.");
      }

      const currentBalanceNative = await getWalletBalanceNative(wallet.id, networkEnv);
      if (currentBalanceNative < amountNative) {
        return status(400, "Insufficient wallet balance.");
      }

      const fxNativePerUsd = await resolveFxNativePerUsd(network, { networkEnv });
      if (fxNativePerUsd === null) {
        return status(503, "Price feed temporarily unavailable. Try again shortly.");
      }
      const amountUsdSnapshot = Number(amountNative) / fxNativePerUsd;
      const groupId = await appendWithdrawalRequest({
        walletId: wallet.id,
        networkEnv,
        targetAddress: body.targetAddress,
        amountNative,
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
        balanceNative: balance.balanceNative.toString(),
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
        amountNative: amountNative.toString(),
        targetAddress: body.targetAddress,
        status: "pending" as const,
      };
    },
    {
      body: walletWithdrawalRequestSchema,
      response: {
        200: walletWithdrawalRequestResponseSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
        503: t.String(),
      },
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

      const fxNativePerUsd = await resolveFxNativePerUsd(network, { networkEnv });
      if (fxNativePerUsd !== null) {
        const balance = await buildWalletBalanceSnapshot({
          walletId: wallet.id,
          networkEnv,
          fxNativePerUsd,
        });
        sendToUser(auth.userId, {
          type: "wallet:balance-update",
          walletId: wallet.id,
          networkEnv,
          balanceNative: balance.balanceNative.toString(),
          balanceUsd: balance.balanceUsd.toFixed(8),
          fxNativePerUsd: balance.fxNativePerUsd.toFixed(12),
          at: new Date().toISOString(),
        });
      }
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
      params: withdrawalGroupPathParamsSchema,
      response: {
        200: walletWithdrawalCancelResponseSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
        409: t.String(),
      },
    },
  );
