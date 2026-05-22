import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../../db";
import { userWallets } from "../../schema/user-wallets";
import { deriveSuiAddress } from "./wallet-derive";

export type WalletNetwork = "sui";

export type UserWalletRecord = {
  id: string;
  userId: string;
  network: WalletNetwork;
  address: string;
  derivationIndex: number;
  topupCursor: string | null;
  topupCursorCheckpoint: number | null;
};

export const getUserWallet = async ({
  userId,
  network = "sui",
}: {
  userId: string;
  network?: WalletNetwork;
}): Promise<UserWalletRecord | null> => {
  const rows = await db
    .select({
      id: userWallets.id,
      userId: userWallets.userId,
      network: userWallets.network,
      address: userWallets.address,
      derivationIndex: userWallets.derivationIndex,
      topupCursor: userWallets.topupCursor,
      topupCursorCheckpoint: userWallets.topupCursorCheckpoint,
    })
    .from(userWallets)
    .where(and(eq(userWallets.userId, userId), eq(userWallets.network, network)))
    .limit(1);

  return rows[0] ?? null;
};

const createOrLoadUserWallet = async ({
  executor,
  userId,
  network,
}: {
  executor: typeof db;
  userId: string;
  network: WalletNetwork;
}) => {
  const existingRows = await executor
    .select({
      id: userWallets.id,
      userId: userWallets.userId,
      network: userWallets.network,
      address: userWallets.address,
      derivationIndex: userWallets.derivationIndex,
      topupCursor: userWallets.topupCursor,
      topupCursorCheckpoint: userWallets.topupCursorCheckpoint,
    })
    .from(userWallets)
    .where(and(eq(userWallets.userId, userId), eq(userWallets.network, network)))
    .limit(1);

  const existing = existingRows[0];
  if (existing) {
    return existing;
  }

  const maxRows = await executor
    .select({
      maxDerivationIndex: sql<number>`coalesce(max(${userWallets.derivationIndex}), -1)`,
    })
    .from(userWallets)
    .where(eq(userWallets.network, network))
    .limit(1);
  const maxDerivationIndex = maxRows[0]?.maxDerivationIndex ?? -1;
  const derivationIndex = maxDerivationIndex + 1;
  const address = deriveSuiAddress(derivationIndex);

  const inserted = await executor
    .insert(userWallets)
    .values({
      userId,
      network,
      address,
      derivationIndex,
    })
    .returning({
      id: userWallets.id,
      userId: userWallets.userId,
      network: userWallets.network,
      address: userWallets.address,
      derivationIndex: userWallets.derivationIndex,
      topupCursor: userWallets.topupCursor,
      topupCursorCheckpoint: userWallets.topupCursorCheckpoint,
    });

  const created = inserted[0];
  if (!created) {
    throw new Error("Unable to create custodial wallet.");
  }

  return created;
};

export const ensureUserWallet = async ({
  executor,
  userId,
  network = "sui",
}: {
  executor?: typeof db;
  userId: string;
  network?: WalletNetwork;
}): Promise<UserWalletRecord> => {
  if (executor) {
    return createOrLoadUserWallet({ executor, userId, network });
  }
  return db.transaction(async (tx) =>
    createOrLoadUserWallet({ executor: tx as unknown as typeof db, userId, network }),
  );
};

export const listWalletsForNetwork = async (network: WalletNetwork) =>
  db
    .select({
      id: userWallets.id,
      userId: userWallets.userId,
      network: userWallets.network,
      address: userWallets.address,
      derivationIndex: userWallets.derivationIndex,
      topupCursor: userWallets.topupCursor,
      topupCursorCheckpoint: userWallets.topupCursorCheckpoint,
      createdAt: userWallets.createdAt,
      updatedAt: userWallets.updatedAt,
    })
    .from(userWallets)
    .where(eq(userWallets.network, network))
    .orderBy(desc(userWallets.createdAt));

export const updateWalletTopupCursor = async ({
  walletId,
  topupCursor,
  topupCursorCheckpoint,
}: {
  walletId: string;
  topupCursor: string | null;
  topupCursorCheckpoint: number | null;
}) => {
  await db
    .update(userWallets)
    .set({
      topupCursor,
      topupCursorCheckpoint,
      updatedAt: new Date(),
    })
    .where(eq(userWallets.id, walletId));
};
