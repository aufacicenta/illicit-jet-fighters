CREATE TABLE "fighter_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fighter_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"simulation_id" uuid NOT NULL,
	"agent_version_id" uuid,
	"object_key" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "simulation_participants" ADD COLUMN "checkpoint_hash" text;--> statement-breakpoint
ALTER TABLE "fighter_checkpoints" ADD CONSTRAINT "fighter_checkpoints_fighter_id_fighters_id_fk" FOREIGN KEY ("fighter_id") REFERENCES "public"."fighters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighter_checkpoints" ADD CONSTRAINT "fighter_checkpoints_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighter_checkpoints" ADD CONSTRAINT "fighter_checkpoints_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighter_checkpoints" ADD CONSTRAINT "fighter_checkpoints_agent_version_id_fighter_agent_versions_id_fk" FOREIGN KEY ("agent_version_id") REFERENCES "public"."fighter_agent_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fighter_checkpoints_fighter_id_idx" ON "fighter_checkpoints" USING btree ("fighter_id");--> statement-breakpoint
CREATE INDEX "fighter_checkpoints_user_id_idx" ON "fighter_checkpoints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fighter_checkpoints_simulation_id_idx" ON "fighter_checkpoints" USING btree ("simulation_id");--> statement-breakpoint
CREATE INDEX "fighter_checkpoints_agent_version_id_idx" ON "fighter_checkpoints" USING btree ("agent_version_id");