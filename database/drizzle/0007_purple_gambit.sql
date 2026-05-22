CREATE TABLE "battlefields" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"briefing" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "llm_usage_events" ADD COLUMN "battlefield_id" integer;--> statement-breakpoint
ALTER TABLE "battlefields" ADD CONSTRAINT "battlefields_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "battlefields_user_id_idx" ON "battlefields" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "llm_usage_events" ADD CONSTRAINT "llm_usage_events_battlefield_id_battlefields_id_fk" FOREIGN KEY ("battlefield_id") REFERENCES "public"."battlefields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "llm_usage_events_battlefield_id_idx" ON "llm_usage_events" USING btree ("battlefield_id");--> statement-breakpoint
CREATE INDEX "llm_usage_events_user_battlefield_idx" ON "llm_usage_events" USING btree ("user_id","battlefield_id");