import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { llmUsageEvents } from "./llm-usage-events";
import { userWallets } from "./user-wallets";

export const walletLedgerKindEnum = pgEnum("wallet_ledger_kind", [
  "topup",
  "charge",
  "fee",
  "withdrawal_request",
  "withdrawal_broadcast",
  "withdrawal_confirm",
  "withdrawal_refund",
  "adjustment",
]);

export const walletLedgerEntries = pgTable(
  "wallet_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => userWallets.id, { onDelete: "cascade" }),
    kind: walletLedgerKindEnum("kind").notNull(),
    amountNative: numeric("amount_native", { precision: 30, scale: 0 }).notNull(),
    amountUsdSnapshot: numeric("amount_usd_snapshot", { precision: 18, scale: 8 }).notNull(),
    fxNativePerUsd: numeric("fx_native_per_usd", { precision: 30, scale: 12 }).notNull(),
    correlationId: text("correlation_id"),
    llmUsageEventId: uuid("llm_usage_event_id").references(() => llmUsageEvents.id, {
      onDelete: "set null",
    }),
    groupId: uuid("group_id"),
    txHash: text("tx_hash"),
    targetAddress: text("target_address"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("wallet_ledger_entries_wallet_id_idx").on(table.walletId),
    index("wallet_ledger_entries_wallet_created_at_idx").on(table.walletId, table.createdAt),
    index("wallet_ledger_entries_llm_usage_event_id_idx").on(table.llmUsageEventId),
    index("wallet_ledger_entries_group_id_idx").on(table.groupId),
    uniqueIndex("wallet_ledger_entries_wallet_tx_hash_topup_key")
      .on(table.walletId, table.txHash)
      .where(sql`${table.kind} = 'topup'`),
    uniqueIndex("wallet_ledger_entries_usage_kind_charge_fee_key")
      .on(table.llmUsageEventId, table.kind)
      .where(sql`${table.kind} in ('charge', 'fee')`),
    uniqueIndex("wallet_ledger_entries_group_kind_terminal_key")
      .on(table.groupId, table.kind)
      .where(
        sql`${table.kind} in ('withdrawal_request', 'withdrawal_confirm', 'withdrawal_refund')`,
      ),
  ],
);
