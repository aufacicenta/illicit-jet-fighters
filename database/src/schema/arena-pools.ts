import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { walletNetworkEnum } from "./wallet-networks";

export const arenaBattleModeEnum = pgEnum("arena_battle_mode", [
  "1v1",
  "squad_4",
  "squad_8",
  "world_war",
]);

export const fighterArenaStatusEnum = pgEnum("fighter_arena_status", [
  "idle",
  "queued",
  "in_simulation",
  "settling",
]);

export const arenaPools = pgTable(
  "arena_pools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    network: walletNetworkEnum("network").notNull().default("sui"),
    battleMode: arenaBattleModeEnum("battle_mode").notNull(),
    stakeAmountNative: numeric("stake_amount_native", { precision: 30, scale: 0 }).notNull(),
    minFighters: integer("min_fighters").notNull(),
    maxFighters: integer("max_fighters").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("arena_pools_network_mode_stake_key").on(
      table.network,
      table.battleMode,
      table.stakeAmountNative,
    ),
  ],
);

export type ArenaBattleMode = (typeof arenaBattleModeEnum.enumValues)[number];

export const ARENA_BATTLE_MODE_LIMITS: Record<
  ArenaBattleMode,
  { minFighters: number; maxFighters: number }
> = {
  "1v1": { minFighters: 2, maxFighters: 2 },
  squad_4: { minFighters: 4, maxFighters: 4 },
  squad_8: { minFighters: 8, maxFighters: 8 },
  world_war: { minFighters: 8, maxFighters: 16 },
};
