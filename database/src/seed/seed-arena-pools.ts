import "./load-env";

import { db } from "../db";
import {
  ARENA_BATTLE_MODE_LIMITS,
  type ArenaBattleMode,
  arenaPools,
} from "../schema/arena-pools";

/** Default SUI stake tiers in MIST (whole SUI × 10^9). */
const ARENA_STAKE_TIERS_SUI_MIST = [
  "1000000000",
  "10000000000",
  "50000000000",
  "100000000000",
  "1000000000000",
] as const;

const ARENA_POOL_SEED_BATTLE_MODES = [
  "1v1",
  "squad_4",
  "squad_8",
  "world_war",
] as const satisfies readonly ArenaBattleMode[];

type ArenaPoolSeedRow = {
  network: "sui";
  battleMode: ArenaBattleMode;
  stakeAmountNative: string;
  minFighters: number;
  maxFighters: number;
  isActive: boolean;
};

/** 5 stake tiers × 4 battle modes = 20 default arena pools on Sui. */
const buildDefaultArenaPoolSeedRows = (): ArenaPoolSeedRow[] => {
  const rows: ArenaPoolSeedRow[] = [];

  for (const battleMode of ARENA_POOL_SEED_BATTLE_MODES) {
    const { minFighters, maxFighters } = ARENA_BATTLE_MODE_LIMITS[battleMode];
    for (const stakeAmountNative of ARENA_STAKE_TIERS_SUI_MIST) {
      rows.push({
        network: "sui",
        battleMode,
        stakeAmountNative,
        minFighters,
        maxFighters,
        isActive: true,
      });
    }
  }

  return rows;
};

export const seedArenaPools = async () => {
  const rows = buildDefaultArenaPoolSeedRows();

  const inserted = await db
    .insert(arenaPools)
    .values(rows)
    .onConflictDoNothing({
      target: [arenaPools.network, arenaPools.battleMode, arenaPools.stakeAmountNative],
    })
    .returning({ id: arenaPools.id });

  return { attempted: rows.length, inserted: inserted.length };
};

const main = async () => {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required to seed arena pools.");
  }

  const { attempted, inserted } = await seedArenaPools();
  const skipped = attempted - inserted;

  if (inserted === 0) {
    console.log(
      `Arena pools: all ${attempted} default pool(s) already present (skipped ${skipped}).`,
    );
    return;
  }

  console.log(`Arena pools: inserted ${inserted} row(s), skipped ${skipped} existing.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
