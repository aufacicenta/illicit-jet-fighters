DROP INDEX "user_wallets_network_env_idx";--> statement-breakpoint
DROP INDEX "user_wallets_user_network_env_key";--> statement-breakpoint
DROP INDEX "user_wallets_network_env_address_key";--> statement-breakpoint
DROP INDEX "user_wallets_network_env_derivation_idx_key";--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallets_user_network_key" ON "user_wallets" USING btree ("user_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallets_network_address_key" ON "user_wallets" USING btree ("network","address");--> statement-breakpoint
CREATE UNIQUE INDEX "user_wallets_network_derivation_idx_key" ON "user_wallets" USING btree ("network","derivation_index");--> statement-breakpoint
ALTER TABLE "user_wallets" DROP COLUMN "network_env";