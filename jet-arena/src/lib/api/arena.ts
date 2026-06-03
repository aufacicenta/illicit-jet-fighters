import { apiRoutes } from "../../hooks/useRoutes";
import { get, post } from "./client";

export type ArenaPool = {
  id: string;
  network: "sui";
  battleMode: "1v1" | "squad_4" | "squad_8" | "world_war";
  stakeAmountNative: string;
  minFighters: number;
  maxFighters: number;
  isActive: boolean;
  queuedCount: number;
};

export type ArenaQueueEntry = {
  id: string;
  poolId: string;
  fighterId: number;
  userId: string;
  status: "queued" | "matched" | "cancelled";
  simulationId: string | null;
  lockCorrelationId: string | null;
  agentVersionId: string | null;
  queuedAt: string;
  matchedAt: string | null;
};

export const fetchArenaPools = async (): Promise<{ pools: ArenaPool[] }> =>
  get<{ pools: ArenaPool[] }>(apiRoutes.arenaPools);

export const fetchArenaPool = async (
  poolId: string,
): Promise<{ pool: ArenaPool; queue: ArenaQueueEntry[] }> =>
  get<{ pool: ArenaPool; queue: ArenaQueueEntry[] }>(apiRoutes.arenaPool(poolId));

export const postArenaPoolEnter = async (
  poolId: string,
  fighterId: number,
  agentVersionId?: string,
): Promise<{
  entry: ArenaQueueEntry;
  match: {
    simulationId: string;
    broadcastId: string;
    matchedFighterIds: number[];
  } | null;
}> =>
  post<{
    entry: ArenaQueueEntry;
    match: {
      simulationId: string;
      broadcastId: string;
      matchedFighterIds: number[];
    } | null;
  }>(apiRoutes.arenaPoolEnter(poolId), {
    fighterId,
    ...(agentVersionId ? { agentVersionId } : {}),
  });

export const postArenaPoolLeave = async (poolId: string, fighterId: number) =>
  post<{ cancelled: boolean }>(apiRoutes.arenaPoolLeave(poolId), { fighterId });

export const fetchArenaMyQueue = async () =>
  get<{
    entries: Array<
      ArenaQueueEntry & {
        network: "sui";
        battleMode: ArenaPool["battleMode"];
        stakeAmountNative: string;
        minFighters: number;
        maxFighters: number;
      }
    >;
  }>(apiRoutes.arenaMyQueue);

export const fetchArenaMyActive = async () =>
  get<{
    fighters: Array<{
      id: number;
      slug: string;
      name: string | null;
      arenaStatus: "idle" | "queued" | "in_simulation" | "settling";
      poolId: string | null;
      simulationId: string | null;
      battleMode: ArenaPool["battleMode"] | null;
      stakeAmountNative: string | null;
    }>;
  }>(apiRoutes.arenaMyActive);
