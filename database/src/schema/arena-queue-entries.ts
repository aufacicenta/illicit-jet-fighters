import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { arenaPools } from "./arena-pools";
import { fighterAgentVersions } from "./fighter-agent-versions";
import { fighters } from "./fighters";
import { simulations } from "./simulations";

export const arenaQueueStatusEnum = pgEnum("arena_queue_status", [
  "queued",
  "matched",
  "cancelled",
]);

export const arenaQueueEntries = pgTable(
  "arena_queue_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => arenaPools.id, { onDelete: "cascade" }),
    fighterId: integer("fighter_id")
      .notNull()
      .references(() => fighters.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    status: arenaQueueStatusEnum("status").notNull().default("queued"),
    simulationId: uuid("simulation_id").references(() => simulations.id, { onDelete: "set null" }),
    lockCorrelationId: text("lock_correlation_id"),
    agentVersionId: uuid("agent_version_id").references(() => fighterAgentVersions.id, {
      onDelete: "set null",
    }),
    queuedAt: timestamp("queued_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    matchedAt: timestamp("matched_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("arena_queue_entries_fighter_pool_queued_key")
      .on(table.fighterId, table.poolId)
      .where(sql`${table.status} = 'queued'`),
    index("arena_queue_entries_pool_status_idx").on(table.poolId, table.status),
    index("arena_queue_entries_fighter_id_idx").on(table.fighterId),
    index("arena_queue_entries_simulation_id_idx").on(table.simulationId),
  ],
);
