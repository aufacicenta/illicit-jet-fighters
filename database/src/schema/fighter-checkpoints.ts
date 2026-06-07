import { index, integer, pgSchema, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { fighterAgentVersions } from "./fighter-agent-versions";
import { fighters } from "./fighters";
import { simulations } from "./simulations";

const neonAuthSchema = pgSchema("neon_auth");

const neonAuthUser = neonAuthSchema.table("user", {
  id: text("id").primaryKey(),
});

export const fighterCheckpoints = pgTable(
  "fighter_checkpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fighterId: integer("fighter_id")
      .notNull()
      .references(() => fighters.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => neonAuthUser.id, { onDelete: "cascade" }),
    simulationId: uuid("simulation_id")
      .notNull()
      .references(() => simulations.id, { onDelete: "cascade" }),
    agentVersionId: uuid("agent_version_id").references(() => fighterAgentVersions.id, {
      onDelete: "set null",
    }),
    objectKey: text("object_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("fighter_checkpoints_fighter_id_idx").on(table.fighterId),
    index("fighter_checkpoints_user_id_idx").on(table.userId),
    index("fighter_checkpoints_simulation_id_idx").on(table.simulationId),
    index("fighter_checkpoints_agent_version_id_idx").on(table.agentVersionId),
  ],
);
