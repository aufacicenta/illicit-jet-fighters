CREATE TABLE "fighters" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fighters" ADD CONSTRAINT "fighters_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fighters_slug_key" ON "fighters" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "fighters_user_id_idx" ON "fighters" USING btree ("user_id");