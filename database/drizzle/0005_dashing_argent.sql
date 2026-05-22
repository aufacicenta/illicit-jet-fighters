CREATE TABLE "llm_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fighter_id" integer,
	"section_id" text NOT NULL,
	"correlation_id" text,
	"openrouter_generation_id" text,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_credits" numeric(12, 8) DEFAULT '0' NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "llm_usage_events" ADD CONSTRAINT "llm_usage_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage_events" ADD CONSTRAINT "llm_usage_events_fighter_id_fighters_id_fk" FOREIGN KEY ("fighter_id") REFERENCES "public"."fighters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "llm_usage_events_user_id_idx" ON "llm_usage_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "llm_usage_events_fighter_id_idx" ON "llm_usage_events" USING btree ("fighter_id");--> statement-breakpoint
CREATE INDEX "llm_usage_events_section_id_idx" ON "llm_usage_events" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "llm_usage_events_user_fighter_idx" ON "llm_usage_events" USING btree ("user_id","fighter_id");