import {
  arenaEnterPoolRequestSchema,
  arenaEnterPoolResponseSchema,
  arenaFighterEligibilityRequestSchema,
  arenaFighterEligibilityResponseSchema,
  arenaLeavePoolRequestSchema,
  arenaLeavePoolResponseSchema,
  arenaMyActiveResponseSchema,
  arenaMyQueueResponseSchema,
  arenaPoolDetailResponseSchema,
  arenaPoolIdPathParamsSchema,
  arenaPoolListResponseSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import { listFighterAgentVersionSummaries } from "../../lib/agent-version-repository";
import { getFighterAvailableBalanceNative } from "../../lib/arena/balance-lock";
import { enterFighterInArenaPool, leaveArenaPool } from "../../lib/arena/matchmaker";
import {
  getPoolById,
  getQueuedEntriesForPool,
  listActivePools,
  listOpponentsBySimulationIds,
  listUserActiveArenaFighters,
  listUserQueueEntries,
} from "../../lib/arena/pool-repository";
import { fighterKeyFromId, getOwnedFighter } from "../../lib/fighter-access";
import { bindPipelineTenant, deriveSectionStatusesOnly } from "../../lib/pipeline-runner";
import { requireBearerAuth } from "../../lib/require-bearer-auth";
import { getFighterBalanceNative } from "../../lib/wallet/ledger";

const serializeQueueEntry = (entry: {
  id: string;
  poolId: string;
  fighterId: number;
  userId: string;
  status: "queued" | "matched" | "cancelled";
  simulationId: string | null;
  lockCorrelationId: string | null;
  agentVersionId: string | null;
  queuedAt: Date;
  matchedAt: Date | null;
}) => ({
  id: entry.id,
  poolId: entry.poolId,
  fighterId: entry.fighterId,
  userId: entry.userId,
  status: entry.status,
  simulationId: entry.simulationId,
  lockCorrelationId: entry.lockCorrelationId,
  agentVersionId: entry.agentVersionId,
  queuedAt: entry.queuedAt.toISOString(),
  matchedAt: entry.matchedAt?.toISOString() ?? null,
});

const serializePool = (pool: {
  id: string;
  network: string;
  battleMode: "1v1" | "squad_4" | "squad_8" | "world_war";
  stakeAmountNative: string;
  minFighters: number;
  maxFighters: number;
  isActive: boolean;
  queuedCount: number;
}) => ({
  id: pool.id,
  network: pool.network as "sui",
  battleMode: pool.battleMode,
  stakeAmountNative: pool.stakeAmountNative,
  minFighters: pool.minFighters,
  maxFighters: pool.maxFighters,
  isActive: pool.isActive,
  queuedCount: pool.queuedCount,
});

export const arenaRoutes = new Elysia({ prefix: "/arena" })
  .get(
    "/pools",
    async ({ request, headers }) => {
      await requireBearerAuth(request, headers);
      const pools = await listActivePools();
      return { pools: pools.map(serializePool) };
    },
    {
      response: {
        200: arenaPoolListResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .get(
    "/pools/:poolId",
    async ({ params, request, headers, status }) => {
      await requireBearerAuth(request, headers);
      const pool = await getPoolById(params.poolId);
      if (!pool) {
        return status(404, "Arena pool not found.");
      }
      const queue = await getQueuedEntriesForPool(params.poolId);
      return {
        pool: serializePool(pool),
        queue: queue.map(serializeQueueEntry),
      };
    },
    {
      params: arenaPoolIdPathParamsSchema,
      response: {
        200: arenaPoolDetailResponseSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  )
  .post(
    "/pools/:poolId/enter",
    async ({ params, body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      try {
        const result = await enterFighterInArenaPool({
          poolId: params.poolId,
          fighterId: body.fighterId,
          userId: auth.userId,
          agentVersionId: body.agentVersionId,
        });
        return {
          entry: serializeQueueEntry(result.entry),
          match: result.match,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to enter arena pool.";
        return status(400, message);
      }
    },
    {
      params: arenaPoolIdPathParamsSchema,
      body: arenaEnterPoolRequestSchema,
      response: {
        200: arenaEnterPoolResponseSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .post(
    "/pools/:poolId/leave",
    async ({ params, body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      try {
        const result = await leaveArenaPool({
          poolId: params.poolId,
          fighterId: body.fighterId,
          userId: auth.userId,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to leave arena pool.";
        return status(400, message);
      }
    },
    {
      params: arenaPoolIdPathParamsSchema,
      body: arenaLeavePoolRequestSchema,
      response: {
        200: arenaLeavePoolResponseSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .get(
    "/me/queue",
    async ({ request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const entries = await listUserQueueEntries(auth.userId);

      const simulationIds = entries
        .map((e) => e.simulationId)
        .filter((id): id is string => id !== null);
      const opponentsBySimId = await listOpponentsBySimulationIds(simulationIds);

      return {
        entries: entries.map((entry) => {
          const allParticipants = entry.simulationId
            ? (opponentsBySimId.get(entry.simulationId) ?? [])
            : [];
          const opponents = allParticipants.filter((p) => p.fighterId !== entry.fighterId);

          return {
            ...serializeQueueEntry(entry),
            network: entry.network as "sui",
            battleMode: entry.battleMode,
            stakeAmountNative: entry.stakeAmountNative,
            minFighters: entry.minFighters,
            maxFighters: entry.maxFighters,
            broadcastId: entry.broadcastId ?? null,
            winnerFighterId: entry.winnerFighterId ?? null,
            simulationStatus: entry.simulationStatus ?? null,
            fighterSlug: entry.fighterSlug,
            fighterName: entry.fighterName,
            opponents,
          };
        }),
      };
    },
    {
      response: {
        200: arenaMyQueueResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .get(
    "/me/active",
    async ({ request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const fighters = await listUserActiveArenaFighters(auth.userId);
      return {
        fighters: fighters.map((fighter) => ({
          id: fighter.id,
          slug: fighter.slug,
          name: fighter.name,
          arenaStatus: fighter.arenaStatus,
          poolId: fighter.poolId,
          simulationId: fighter.simulationId,
          battleMode: fighter.battleMode,
          stakeAmountNative: fighter.stakeAmountNative,
        })),
      };
    },
    {
      response: {
        200: arenaMyActiveResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .post(
    "/fighters/eligibility",
    async ({ body, request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const { fighterIds } = body;

      const results = await Promise.all(
        fighterIds.map(async (fighterId) => {
          const owned = await getOwnedFighter(fighterId, auth.userId);
          if (!owned) return null;

          const fighterKey = fighterKeyFromId(fighterId);
          bindPipelineTenant(fighterKey, { userId: auth.userId, fighterId });

          const [sectionStatuses, balanceNative, availableBalanceNative, versions] =
            await Promise.all([
              deriveSectionStatusesOnly(fighterKey),
              getFighterBalanceNative(fighterId),
              getFighterAvailableBalanceNative(fighterId),
              listFighterAgentVersionSummaries({ fighterId, userId: auth.userId }),
            ]);

          return {
            fighterId,
            sectionStatuses: sectionStatuses ?? {},
            fighterBalanceNative: balanceNative.toString(),
            availableBalanceNative: availableBalanceNative.toString(),
            versions: versions.map((v) => ({ id: v.id, versionNumber: v.versionNumber })),
          };
        }),
      );

      return { fighters: results.filter((r): r is NonNullable<typeof r> => r !== null) };
    },
    {
      body: arenaFighterEligibilityRequestSchema,
      response: {
        200: arenaFighterEligibilityResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  );
