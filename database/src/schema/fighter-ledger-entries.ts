import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { fighters } from "./fighters";
import { walletLedgerEntries } from "./wallet-ledger-entries";

export const fighterLedgerKindEnum = pgEnum("fighter_ledger_kind", [
  "fighter_transfer_in",
  "fighter_transfer_out",
  "fighter_sim_bounty_in",
  "fighter_sim_bet_out",
]);

export const fighterLedgerEntries = pgTable(
  "fighter_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fighterId: integer("fighter_id")
      .notNull()
      .references(() => fighters.id, { onDelete: "cascade" }),
    kind: fighterLedgerKindEnum("kind").notNull(),
    amountNative: numeric("amount_native", { precision: 30, scale: 0 }).notNull(),
    walletLedgerEntryId: uuid("wallet_ledger_entry_id")
      .notNull()
      .references(() => walletLedgerEntries.id, { onDelete: "cascade" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("fighter_ledger_entries_fighter_id_created_at_idx").on(table.fighterId, table.createdAt),
    uniqueIndex("fighter_ledger_entries_wallet_ledger_entry_id_key").on(table.walletLedgerEntryId),
  ],
);
