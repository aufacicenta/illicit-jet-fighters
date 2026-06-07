import {
  bigint,
  index,
  integer,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { arenaPools } from "./arena-pools";
import { fighterAgentVersions } from "./fighter-agent-versions";
import { fighters } from "./fighters";

const neonAuthSchema = pgSchema("neon_auth");

const neonAuthUser = neonAuthSchema.table("user", {
  id: text("id").primaryKey(),
});

export const simulationStatusEnum = pgEnum("simulation_status", [
  "queued",
  "running",
  "ended",
  "error",
]);

export const simulationAgentSourceEnum = pgEnum("simulation_agent_source", [
  "r2",
  "pipeline",
  "fallback",
]);

export const simulations = pgTable(
  "simulations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => neonAuthUser.id, { onDelete: "cascade" }),
    seed: bigint("seed", { mode: "number" }).notNull(),
    status: simulationStatusEnum("status").notNull().default("queued"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    winnerId: text("winner_id"),
    winnerFighterId: integer("winner_fighter_id").references(() => fighters.id, {
      onDelete: "set null",
    }),
    errorMessage: text("error_message"),
    replayHashHex: text("replay_hash_hex"),
    replayFrameCount: integer("replay_frame_count").notNull().default(0),
    replayObjectKey: text("replay_object_key"),
    broadcastEventsObjectKey: text("broadcast_events_object_key"),
    arenaPoolId: uuid("arena_pool_id").references(() => arenaPools.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("simulations_user_id_idx").on(table.userId),
    index("simulations_status_idx").on(table.status),
  ],
);

export const broadcasts = pgTable(
  "broadcasts",
  {
    id: text("id").primaryKey(),
    simulationId: uuid("simulation_id")
      .notNull()
      .references(() => simulations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => neonAuthUser.id, { onDelete: "cascade" }),
    status: simulationStatusEnum("status").notNull().default("queued"),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true, mode: "date" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("broadcasts_simulation_id_key").on(table.simulationId),
    index("broadcasts_user_id_idx").on(table.userId),
  ],
);

export const simulationParticipants = pgTable(
  "simulation_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    simulationId: uuid("simulation_id")
      .notNull()
      .references(() => simulations.id, { onDelete: "cascade" }),
    fighterId: integer("fighter_id")
      .notNull()
      .references(() => fighters.id, { onDelete: "cascade" }),
    playerSlot: integer("player_slot").notNull(),
    playerId: text("player_id").notNull(),
    agentSource: simulationAgentSourceEnum("agent_source").notNull(),
    agentObjectKey: text("agent_object_key"),
    agentHash: text("agent_hash"),
    agentVersionId: uuid("agent_version_id").references(() => fighterAgentVersions.id, {
      onDelete: "set null",
    }),
    checkpointHash: text("checkpoint_hash"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("simulation_participants_sim_slot_key").on(table.simulationId, table.playerSlot),
    uniqueIndex("simulation_participants_sim_player_key").on(table.simulationId, table.playerId),
    index("simulation_participants_fighter_id_idx").on(table.fighterId),
    index("simulation_participants_agent_version_id_idx").on(table.agentVersionId),
  ],
);
