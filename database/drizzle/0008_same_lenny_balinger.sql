CREATE TYPE "public"."wallet_network_env" AS ENUM('testnet', 'devnet', 'mainnet');--> statement-breakpoint
DROP INDEX "user_wallets_network_idx";--> statement-breakpoint
DROP INDEX "user_wallets_user_network_key";--> statement-breakpoint
DROP INDEX "user_wallets_network_address_key";--> statement-breakpoint
DROP INDEX "user_wallets_network_derivation_idx_key";--> statement-breakpoint
DROP INDEX "wallet_ledger_entries_wallet_created_at_idx";--> statement-breakpoint
ALTER TABLE "user_wallets" ADD COLUMN "network_env" "wallet_network_env" DEFAULT 'testnet' NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD COLUMN "network_env" "wallet_network_env" DEFAULT 'testnet' NOT NULL;--> statement-breakpoint
CREATE INDEX "user_wallets_network_env_idx" ON "user_wallets" USING btree ("network","network_env");--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallets_user_network_env_key" ON "user_wallets" USING btree ("user_id","network","network_env");--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallets_network_env_address_key" ON "user_wallets" USING btree ("network","network_env","address");--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallets_network_env_derivation_idx_key" ON "user_wallets" USING btree ("network","network_env","derivation_index");--> statement-breakpoint
CREATE INDEX "wallet_ledger_entries_wallet_env_idx" ON "wallet_ledger_entries" USING btree ("wallet_id","network_env");--> statement-breakpoint
CREATE INDEX "wallet_ledger_entries_wallet_env_created_at_idx" ON "wallet_ledger_entries" USING btree ("wallet_id","network_env","created_at");