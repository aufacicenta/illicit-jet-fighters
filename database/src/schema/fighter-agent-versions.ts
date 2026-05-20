import {
  index,
  integer,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { fighters } from "./fighters";

const neonAuthSchema = pgSchema("neon_auth");

const neonAuthUser = neonAuthSchema.table("user", {
  id: text("id").primaryKey(),
});

export const fighterAgentVersions = pgTable(
  "fighter_agent_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fighterId: integer("fighter_id")
      .notNull()
      .references(() => fighters.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => neonAuthUser.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    contentHash: text("content_hash").notNull(),
    objectKey: text("object_key").notNull(),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("fighter_agent_versions_fighter_version_key").on(
      table.fighterId,
      table.versionNumber,
    ),
    index("fighter_agent_versions_fighter_id_idx").on(table.fighterId),
    index("fighter_agent_versions_user_id_idx").on(table.userId),
  ],
);
