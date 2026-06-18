import { sql } from "drizzle-orm";

import { env } from "../config/env";
import { db } from "../db";
import { ensureUserWallet } from "../lib/wallet/wallet-provision";

type UserWithoutWalletRow = {
  userId: string;
};

const main = async () => {
  if (!env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required to run the wallet provision seed.");
  }

  if (!env.WALLET_MASTER_MNEMONIC?.trim()) {
    throw new Error("WALLET_MASTER_MNEMONIC is required to run the wallet provision seed.");
  }

  const result = await db.execute<UserWithoutWalletRow>(sql`
    SELECT u.id AS "userId"
    FROM neon_auth."user" u
    LEFT JOIN public.user_wallets w
      ON w.user_id = u.id
      AND w.network = 'sui'::public.wallet_network
    WHERE w.id IS NULL
  `);

  const usersWithoutWallets = result.rows;

  if (usersWithoutWallets.length === 0) {
    console.log("All users already have a Sui wallet.");
    return;
  }

  console.log(`Provisioning Sui wallets for ${usersWithoutWallets.length} user(s)...`);

  let provisioned = 0;
  for (const { userId } of usersWithoutWallets) {
    const wallet = await ensureUserWallet({ executor: db, userId, network: "sui" });
    provisioned += 1;
    console.log(`  [${provisioned}/${usersWithoutWallets.length}] ${userId} -> ${wallet.address}`);
  }

  console.log(`Done. Provisioned ${provisioned} wallet(s).`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
