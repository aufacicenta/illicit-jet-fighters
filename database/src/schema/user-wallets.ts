import {
  bigint,
  index,
  integer,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { walletNetworkEnum } from "./wallet-networks";

const neonAuthSchema = pgSchema("neon_auth");

/** Neon Auth–managed table; not migrated by this app. */
const neonAuthUser = neonAuthSchema.table("user", {
  id: text("id").primaryKey(),
});

export const userWallets = pgTable(
  "user_wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => neonAuthUser.id, { onDelete: "cascade" }),
    network: walletNetworkEnum("network").notNull().default("sui"),
    address: text("address").notNull(),
    derivationIndex: integer("derivation_index").notNull(),
    topupCursor: text("topup_cursor"),
    topupCursorCheckpoint: bigint("topup_cursor_checkpoint", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("user_wallets_user_id_idx").on(table.userId),
    index("user_wallets_network_idx").on(table.network),
    uniqueIndex("user_wallets_user_network_key").on(table.userId, table.network),
    uniqueIndex("user_wallets_network_address_key").on(table.network, table.address),
    uniqueIndex("user_wallets_network_derivation_idx_key").on(table.network, table.derivationIndex),
  ],
);
