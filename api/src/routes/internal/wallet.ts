import { db, eq, userWallets } from "@ijf/database";
import { Elysia, t } from "elysia";

import { env } from "../../config/env";
import { pushWalletTopupNotifications } from "../../lib/wallet/push-wallet-updates";

const parseIndexerSecret = (request: Request) => {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return bearer.slice("Bearer ".length).trim();
  }
  return request.headers.get("x-wallet-indexer-secret")?.trim() ?? null;
};

export const internalWalletRoutes = new Elysia({ prefix: "/internal/wallet" }).post(
  "/topup",
  async ({ request, body, status }) => {
    const configuredSecret = env.WALLET_INDEXER_SECRET;
    if (!configuredSecret) {
      return status(503, "Wallet indexer notifications are not configured.");
    }

    const providedSecret = parseIndexerSecret(request);
    if (!providedSecret || providedSecret !== configuredSecret) {
      return status(401, "Unauthorized.");
    }

    const amountMist = BigInt(body.amountMist);
    if (amountMist <= 0n) {
      return status(400, "amountMist must be a positive integer string.");
    }

    const [wallet] = await db
      .select({ userId: userWallets.userId })
      .from(userWallets)
      .where(eq(userWallets.id, body.walletId))
      .limit(1);

    if (!wallet) {
      return status(404, "Wallet not found.");
    }

    await pushWalletTopupNotifications({
      userId: wallet.userId,
      walletId: body.walletId,
      txHash: body.txHash,
      amountMist,
      amountUsd: Number.parseFloat(body.amountUsd),
    });

    return { ok: true as const };
  },
  {
    body: t.Object({
      walletId: t.String(),
      txHash: t.String(),
      amountMist: t.String(),
      amountUsd: t.String(),
    }),
  },
);
