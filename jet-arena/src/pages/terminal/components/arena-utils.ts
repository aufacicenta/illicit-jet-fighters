import type { ArenaPool } from "../../../lib/api/arena";

export const arenaBattleModeLabels: Record<ArenaPool["battleMode"], string> = {
  "1v1": "1v1",
  squad_4: "Squad 4",
  squad_8: "Squad 8",
  world_war: "World War",
};

export const formatArenaFightersRange = (pool: Pick<ArenaPool, "minFighters" | "maxFighters">) =>
  pool.minFighters === pool.maxFighters
    ? String(pool.minFighters)
    : `${pool.minFighters}–${pool.maxFighters}`;
