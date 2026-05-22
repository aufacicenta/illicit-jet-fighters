import {
  index,
  integer,
  numeric,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { fighters } from "./fighters";

const neonAuthSchema = pgSchema("neon_auth");

const neonAuthUser = neonAuthSchema.table("user", {
  id: text("id").primaryKey(),
});

export const llmUsageEvents = pgTable(
  "llm_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => neonAuthUser.id, { onDelete: "cascade" }),
    fighterId: integer("fighter_id").references(() => fighters.id, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    correlationId: text("correlation_id"),
    openrouterGenerationId: text("openrouter_generation_id"),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    costCredits: numeric("cost_credits", { precision: 12, scale: 8 }).notNull().default("0"),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("llm_usage_events_user_id_idx").on(table.userId),
    index("llm_usage_events_fighter_id_idx").on(table.fighterId),
    index("llm_usage_events_section_id_idx").on(table.sectionId),
    index("llm_usage_events_user_fighter_idx").on(table.userId, table.fighterId),
  ],
);
