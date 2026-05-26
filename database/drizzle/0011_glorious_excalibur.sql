CREATE TYPE "public"."fighter_ledger_kind" AS ENUM('fighter_transfer_in', 'fighter_transfer_out', 'fighter_sim_bounty_in', 'fighter_sim_bet_out');--> statement-breakpoint
ALTER TYPE "public"."wallet_ledger_kind" ADD VALUE 'fighter_transfer_in' BEFORE 'withdrawal_request';--> statement-breakpoint
ALTER TYPE "public"."wallet_ledger_kind" ADD VALUE 'fighter_transfer_out' BEFORE 'withdrawal_request';--> statement-breakpoint
CREATE TABLE "fighter_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fighter_id" integer NOT NULL,
	"kind" "fighter_ledger_kind" NOT NULL,
	"amount_native" numeric(30, 0) NOT NULL,
	"wallet_ledger_entry_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fighter_ledger_entries" ADD CONSTRAINT "fighter_ledger_entries_fighter_id_fighters_id_fk" FOREIGN KEY ("fighter_id") REFERENCES "public"."fighters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighter_ledger_entries" ADD CONSTRAINT "fighter_ledger_entries_wallet_ledger_entry_id_wallet_ledger_entries_id_fk" FOREIGN KEY ("wallet_ledger_entry_id") REFERENCES "public"."wallet_ledger_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fighter_ledger_entries_fighter_id_created_at_idx" ON "fighter_ledger_entries" USING btree ("fighter_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fighter_ledger_entries_wallet_ledger_entry_id_key" ON "fighter_ledger_entries" USING btree ("wallet_ledger_entry_id");