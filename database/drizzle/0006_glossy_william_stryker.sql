CREATE TYPE "public"."wallet_ledger_kind" AS ENUM('topup', 'charge', 'fee', 'withdrawal_request', 'withdrawal_broadcast', 'withdrawal_confirm', 'withdrawal_refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."wallet_network" AS ENUM('sui');--> statement-breakpoint
CREATE TABLE "user_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"network" "wallet_network" DEFAULT 'sui' NOT NULL,
	"address" text NOT NULL,
	"derivation_index" integer NOT NULL,
	"topup_cursor" text,
	"topup_cursor_checkpoint" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"kind" "wallet_ledger_kind" NOT NULL,
	"amount_native" numeric(30, 0) NOT NULL,
	"amount_usd_snapshot" numeric(18, 8) NOT NULL,
	"fx_native_per_usd" numeric(30, 12) NOT NULL,
	"correlation_id" text,
	"llm_usage_event_id" uuid,
	"group_id" uuid,
	"tx_hash" text,
	"target_address" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_wallet_id_user_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."user_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_llm_usage_event_id_llm_usage_events_id_fk" FOREIGN KEY ("llm_usage_event_id") REFERENCES "public"."llm_usage_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_wallets_user_id_idx" ON "user_wallets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_wallets_network_idx" ON "user_wallets" USING btree ("network");--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallets_user_network_key" ON "user_wallets" USING btree ("user_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallets_network_address_key" ON "user_wallets" USING btree ("network","address");--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallets_network_derivation_idx_key" ON "user_wallets" USING btree ("network","derivation_index");--> statement-breakpoint
CREATE INDEX "wallet_ledger_entries_wallet_id_idx" ON "wallet_ledger_entries" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "wallet_ledger_entries_wallet_created_at_idx" ON "wallet_ledger_entries" USING btree ("wallet_id","created_at");--> statement-breakpoint
CREATE INDEX "wallet_ledger_entries_llm_usage_event_id_idx" ON "wallet_ledger_entries" USING btree ("llm_usage_event_id");--> statement-breakpoint
CREATE INDEX "wallet_ledger_entries_group_id_idx" ON "wallet_ledger_entries" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_entries_wallet_tx_hash_topup_key" ON "wallet_ledger_entries" USING btree ("wallet_id","tx_hash") WHERE "wallet_ledger_entries"."kind" = 'topup';--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_entries_usage_kind_charge_fee_key" ON "wallet_ledger_entries" USING btree ("llm_usage_event_id","kind") WHERE "wallet_ledger_entries"."kind" in ('charge', 'fee');--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_entries_group_kind_terminal_key" ON "wallet_ledger_entries" USING btree ("group_id","kind") WHERE "wallet_ledger_entries"."kind" in ('withdrawal_request', 'withdrawal_confirm', 'withdrawal_refund');