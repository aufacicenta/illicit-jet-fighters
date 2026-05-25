ALTER TABLE "wallet_ledger_entries" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_parent_id_wallet_ledger_entries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."wallet_ledger_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_ledger_entries_parent_id_idx" ON "wallet_ledger_entries" USING btree ("parent_id");--> statement-breakpoint
UPDATE wallet_ledger_entries fee
SET parent_id = charge.id
FROM wallet_ledger_entries charge
WHERE fee.kind = 'fee'
  AND charge.kind = 'charge'
  AND fee.llm_usage_event_id = charge.llm_usage_event_id
  AND fee.parent_id IS NULL;--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_fee_requires_parent_check" CHECK (("wallet_ledger_entries"."kind" <> 'fee') OR ("wallet_ledger_entries"."parent_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_parent_id_kind_check" CHECK (("wallet_ledger_entries"."parent_id" IS NULL) OR ("wallet_ledger_entries"."kind" in ('fee', 'adjustment')));--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_adjustment_requires_parent_check" CHECK (("wallet_ledger_entries"."kind" <> 'adjustment') OR ("wallet_ledger_entries"."parent_id" IS NOT NULL));