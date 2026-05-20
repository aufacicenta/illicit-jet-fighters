CREATE TYPE "public"."simulation_status" AS ENUM('queued', 'running', 'ended', 'error');--> statement-breakpoint
CREATE TYPE "public"."simulation_agent_source" AS ENUM('r2', 'pipeline', 'fallback');--> statement-breakpoint
CREATE TABLE "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"seed" bigint NOT NULL,
	"status" "simulation_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"winner_id" text,
	"error_message" text,
	"replay_hash_hex" text,
	"replay_frame_count" integer DEFAULT 0 NOT NULL,
	"replay_object_key" text,
	"broadcast_events_object_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" text PRIMARY KEY NOT NULL,
	"simulation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "simulation_status" DEFAULT 'queued' NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"simulation_id" uuid NOT NULL,
	"fighter_id" integer NOT NULL,
	"player_slot" integer NOT NULL,
	"player_id" text NOT NULL,
	"agent_source" "simulation_agent_source" NOT NULL,
	"agent_object_key" text,
	"agent_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_participants" ADD CONSTRAINT "simulation_participants_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_participants" ADD CONSTRAINT "simulation_participants_fighter_id_fighters_id_fk" FOREIGN KEY ("fighter_id") REFERENCES "public"."fighters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "simulations_user_id_idx" ON "simulations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "simulations_status_idx" ON "simulations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "broadcasts_simulation_id_key" ON "broadcasts" USING btree ("simulation_id");--> statement-breakpoint
CREATE INDEX "broadcasts_user_id_idx" ON "broadcasts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "simulation_participants_sim_slot_key" ON "simulation_participants" USING btree ("simulation_id","player_slot");--> statement-breakpoint
CREATE UNIQUE INDEX "simulation_participants_sim_player_key" ON "simulation_participants" USING btree ("simulation_id","player_id");--> statement-breakpoint
CREATE INDEX "simulation_participants_fighter_id_idx" ON "simulation_participants" USING btree ("fighter_id");
