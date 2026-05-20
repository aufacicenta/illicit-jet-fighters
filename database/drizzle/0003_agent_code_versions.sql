CREATE TABLE "fighter_agent_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fighter_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content_hash" text NOT NULL,
	"object_key" text NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "simulation_participants" ADD COLUMN "agent_version_id" uuid;--> statement-breakpoint
ALTER TABLE "fighter_agent_versions" ADD CONSTRAINT "fighter_agent_versions_fighter_id_fighters_id_fk" FOREIGN KEY ("fighter_id") REFERENCES "public"."fighters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fighter_agent_versions" ADD CONSTRAINT "fighter_agent_versions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_participants" ADD CONSTRAINT "simulation_participants_agent_version_id_fighter_agent_versions_id_fk" FOREIGN KEY ("agent_version_id") REFERENCES "public"."fighter_agent_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fighter_agent_versions_fighter_version_key" ON "fighter_agent_versions" USING btree ("fighter_id","version_number");--> statement-breakpoint
CREATE INDEX "fighter_agent_versions_fighter_id_idx" ON "fighter_agent_versions" USING btree ("fighter_id");--> statement-breakpoint
CREATE INDEX "fighter_agent_versions_user_id_idx" ON "fighter_agent_versions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "simulation_participants_agent_version_id_idx" ON "simulation_participants" USING btree ("agent_version_id");
