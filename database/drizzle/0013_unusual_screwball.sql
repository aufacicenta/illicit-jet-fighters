CREATE TYPE "public"."arena_battle_mode" AS ENUM('1v1', 'squad_4', 'squad_8', 'world_war');--> statement-breakpoint
CREATE TYPE "public"."arena_queue_status" AS ENUM('queued', 'matched', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."fighter_arena_status" AS ENUM('idle', 'queued', 'in_simulation', 'settling');--> statement-breakpoint
ALTER TYPE "public"."fighter_ledger_kind" ADD VALUE 'fighter_arena_lock';--> statement-breakpoint
ALTER TYPE "public"."fighter_ledger_kind" ADD VALUE 'fighter_arena_unlock';--> statement-breakpoint
CREATE TABLE "arena_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network" "wallet_network" DEFAULT 'sui' NOT NULL,
	"battle_mode" "arena_battle_mode" NOT NULL,
	"stake_amount_native" numeric(30, 0) NOT NULL,
	"min_fighters" integer NOT NULL,
	"max_fighters" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arena_queue_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"fighter_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "arena_queue_status" DEFAULT 'queued' NOT NULL,
	"simulation_id" uuid,
	"lock_correlation_id" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"matched_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX "fighter_ledger_entries_wallet_ledger_entry_id_key";--> statement-breakpoint
ALTER TABLE "fighter_ledger_entries" ALTER COLUMN "wallet_ledger_entry_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fighters" ADD COLUMN "arena_status" "fighter_arena_status" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN "arena_pool_id" uuid;--> statement-breakpoint
ALTER TABLE "arena_queue_entries" ADD CONSTRAINT "arena_queue_entries_pool_id_arena_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."arena_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_queue_entries" ADD CONSTRAINT "arena_queue_entries_fighter_id_fighters_id_fk" FOREIGN KEY ("fighter_id") REFERENCES "public"."fighters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_queue_entries" ADD CONSTRAINT "arena_queue_entries_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "arena_pools_network_mode_stake_key" ON "arena_pools" USING btree ("network","battle_mode","stake_amount_native");--> statement-breakpoint
CREATE UNIQUE INDEX "arena_queue_entries_fighter_queued_key" ON "arena_queue_entries" USING btree ("fighter_id") WHERE "arena_queue_entries"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "arena_queue_entries_pool_status_idx" ON "arena_queue_entries" USING btree ("pool_id","status");--> statement-breakpoint
CREATE INDEX "arena_queue_entries_fighter_id_idx" ON "arena_queue_entries" USING btree ("fighter_id");--> statement-breakpoint
CREATE INDEX "arena_queue_entries_simulation_id_idx" ON "arena_queue_entries" USING btree ("simulation_id");--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_arena_pool_id_arena_pools_id_fk" FOREIGN KEY ("arena_pool_id") REFERENCES "public"."arena_pools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fighter_ledger_entries_wallet_ledger_entry_id_key" ON "fighter_ledger_entries" USING btree ("wallet_ledger_entry_id") WHERE "fighter_ledger_entries"."wallet_ledger_entry_id" IS NOT NULL;