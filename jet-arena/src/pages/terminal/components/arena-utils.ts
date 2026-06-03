import type { ArenaPool, ArenaQueueEntry } from "../../../lib/api/arena";

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

const arenaQueueStatusClassNames: Record<ArenaQueueEntry["status"], string> = {
  queued: "text-amber-300",
  matched: "text-emerald-400",
  cancelled: "text-muted-foreground",
};

export const getArenaQueueStatusClassName = (status: string): string =>
  arenaQueueStatusClassNames[status as ArenaQueueEntry["status"]] ?? "text-muted-foreground";

export type ArenaPoolsByStake = {
  stakeAmountNative: string;
  pools: ArenaPool[];
};

/** Groups pools by stake; preserves API order (stake asc, then battle mode). */
export const groupArenaPoolsByStake = (pools: ArenaPool[]): ArenaPoolsByStake[] => {
  const groups: ArenaPoolsByStake[] = [];

  for (const pool of pools) {
    const last = groups.at(-1);
    if (last?.stakeAmountNative === pool.stakeAmountNative) {
      last.pools.push(pool);
      continue;
    }
    groups.push({ stakeAmountNative: pool.stakeAmountNative, pools: [pool] });
  }

  return groups;
};
