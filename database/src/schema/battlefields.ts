import { index, pgSchema, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

const neonAuthSchema = pgSchema("neon_auth");

const neonAuthUser = neonAuthSchema.table("user", {
  id: text("id").primaryKey(),
});

export const battlefields = pgTable(
  "battlefields",
  {
    id: serial("id").primaryKey(),
    name: text("name"),
    briefing: text("briefing"),
    userId: uuid("user_id")
      .notNull()
      .references(() => neonAuthUser.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("battlefields_user_id_idx").on(table.userId)],
);
