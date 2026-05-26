import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
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
import { networkEnvEnum } from "./wallet-networks";

export const walletLedgerKindEnum = pgEnum("wallet_ledger_kind", [
  "topup",
  "charge",
  "fee",
  "fighter_transfer_in",
  "fighter_transfer_out",
  "withdrawal_request",
  "withdrawal_broadcast",
  "withdrawal_confirm",
  "withdrawal_refund",
  "adjustment",
]);

export const walletLedgerEntries = pgTable(
  "wallet_ledger_entries",
  {
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => userWallets.id, { onDelete: "cascade" }),
    networkEnv: networkEnvEnum("network_env").notNull().default("testnet"),
    id: uuid("id").defaultRandom().primaryKey(),
    kind: walletLedgerKindEnum("kind").notNull(),
    amountNative: numeric("amount_native", { precision: 30, scale: 0 }).notNull(),
    amountUsdSnapshot: numeric("amount_usd_snapshot", { precision: 18, scale: 8 }).notNull(),
    fxNativePerUsd: numeric("fx_native_per_usd", { precision: 30, scale: 12 }).notNull(),
    correlationId: text("correlation_id"),
    llmUsageEventId: uuid("llm_usage_event_id").references(() => llmUsageEvents.id, {
      onDelete: "set null",
    }),
    parentId: uuid("parent_id").references((): AnyPgColumn => walletLedgerEntries.id, {
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
    index("wallet_ledger_entries_wallet_env_idx").on(table.walletId, table.networkEnv),
    index("wallet_ledger_entries_wallet_env_created_at_idx").on(
      table.walletId,
      table.networkEnv,
      table.createdAt,
    ),
    index("wallet_ledger_entries_llm_usage_event_id_idx").on(table.llmUsageEventId),
    index("wallet_ledger_entries_group_id_idx").on(table.groupId),
    uniqueIndex("wallet_ledger_entries_wallet_tx_hash_topup_key")
      .on(table.walletId, table.txHash)
      .where(sql`${table.kind} = 'topup'`),
    uniqueIndex("wallet_ledger_entries_usage_kind_charge_fee_key")
      .on(table.llmUsageEventId, table.kind)
      .where(sql`${table.kind} in ('charge', 'fee')`),
    index("wallet_ledger_entries_parent_id_idx").on(table.parentId),
    check(
      "wallet_ledger_entries_fee_requires_parent_check",
      sql`(${table.kind} <> 'fee') OR (${table.parentId} IS NOT NULL)`,
    ),
    check(
      "wallet_ledger_entries_parent_id_kind_check",
      sql`(${table.parentId} IS NULL) OR (${table.kind} in ('fee', 'adjustment'))`,
    ),
    check(
      "wallet_ledger_entries_adjustment_requires_parent_check",
      sql`(${table.kind} <> 'adjustment') OR (${table.parentId} IS NOT NULL)`,
    ),
    uniqueIndex("wallet_ledger_entries_group_kind_terminal_key")
      .on(table.groupId, table.kind)
      .where(
        sql`${table.kind} in ('withdrawal_request', 'withdrawal_confirm', 'withdrawal_refund')`,
      ),
  ],
);
