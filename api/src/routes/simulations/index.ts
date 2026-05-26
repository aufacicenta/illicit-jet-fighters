import {
  simulationDetailsSchema,
  simulationIdPathParamsSchema,
  simulationListResponseSchema,
  simulationReplaySnapshotSchema,
  simulationStartRequestSchema,
  simulationStartResponseSchema,
  simulationStatusSnapshotSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import { createCorrelationId } from "../../lib/correlation-id";
import { fighterKeyFromId, getFightersByIds, parseFighterIdParam } from "../../lib/fighter-access";
import { logger } from "../../lib/logger";
import { requireBearerAuth } from "../../lib/require-bearer-auth";
import {
  getReplayForBroadcast,
  getSimulationDetails,
  getSimulationStatusForBroadcast,
  SimulationStartInputError,
  startSimulationForRoster,
} from "../../lib/simulation-orchestrator";
import { listSimulationsForUser } from "../../lib/simulation-repository";

const resolveSimulationFighters = async (
  request: Request,
  headers: Record<string, string | undefined>,
  body: {
    fighterId?: number;
    fighterIds?: number[];
    participants?: Array<{ fighterId: number; agentVersionId?: string | null }>;
  },
) => {
  const auth = await requireBearerAuth(request, headers);
  const requestedParticipants = body.participants?.length
    ? body.participants
    : body.fighterIds?.length
      ? body.fighterIds.map((fighterId) => ({ fighterId, agentVersionId: null }))
      : body.fighterId
        ? [{ fighterId: body.fighterId, agentVersionId: null }]
        : [];
  const parsedParticipants = requestedParticipants
    .map((participant) => ({
      fighterId: parseFighterIdParam(String(participant.fighterId)),
      agentVersionId: participant.agentVersionId ?? null,
    }))
    .filter(
      (participant): participant is { fighterId: number; agentVersionId: string | null } =>
        participant.fighterId !== null,
    );

  if (parsedParticipants.length === 0) {
    return { error: "At least one valid fighter id is required." as const };
  }

  const parsedUniqueIds = [
    ...new Set(parsedParticipants.map((participant) => participant.fighterId)),
  ];
  const fighters = await getFightersByIds(parsedUniqueIds);
  if (fighters.length !== parsedUniqueIds.length) {
    return { error: "One or more fighters were not found." as const };
  }
  const fightersById = new Map(fighters.map((fighter) => [fighter.id, fighter]));

  const unauthorizedParticipant = parsedParticipants.find((participant) => {
    const fighter = fightersById.get(participant.fighterId);
    return fighter && fighter.userId !== auth.userId;
  });
  if (unauthorizedParticipant) {
    return { error: "You can only start simulations with your own fighters." as const };
  }

  return {
    initiatorUserId: auth.userId,
    fighters: parsedParticipants.map((participant) => {
      const fighter = fightersById.get(participant.fighterId);
      if (!fighter) {
        throw new Error("Simulation participant resolution failed.");
      }
      return {
        fighterId: fighter.id,
        fighterKey: fighterKeyFromId(fighter.id),
        fighterName: fighter.name,
        fighterSlug: fighter.slug,
        ownerUserId: fighter.userId,
        agentVersionId: participant.agentVersionId,
      };
    }),
  };
};

export const simulationRoutes = new Elysia({ prefix: "/simulations" })
  .get(
    "",
    async ({ request, headers }) => {
      const auth = await requireBearerAuth(request, headers);

      return {
        simulations: await listSimulationsForUser(auth.userId),
      };
    },
    {
      response: {
        200: simulationListResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .post(
    "",
    async ({ body, request, headers, status }) => {
      const correlationId = createCorrelationId("simulation-start");
      const fighterIds = body.participants?.length
        ? body.participants.map((participant) => participant.fighterId)
        : body.fighterIds?.length
          ? body.fighterIds
          : body.fighterId
            ? [body.fighterId]
            : [];
      const seed = body.seed ?? Date.now();

      logger.info("simulation start endpoint hit", {
        path: "/simulations",
        correlationId,
        fighterIds,
        seedProvided: body.seed !== undefined,
        seed,
      });

      try {
        logger.debug("simulation start resolving fighter roster", {
          path: "/simulations",
          correlationId,
          fighterIds,
        });

        const resolution = await resolveSimulationFighters(request, headers, body);
        if ("error" in resolution) {
          logger.warn("simulation start roster resolution failed", {
            path: "/simulations",
            correlationId,
            fighterIds,
            reason: resolution.error,
          });
          return status(400, resolution.error ?? "Invalid simulation fighters.");
        }

        logger.info("simulation start roster resolved", {
          path: "/simulations",
          correlationId,
          fighterCount: resolution.fighters.length,
          fighterIds: resolution.fighters.map((fighter) => fighter.fighterId),
        });

        logger.debug("simulation start invoking orchestrator", {
          path: "/simulations",
          correlationId,
          fighterCount: resolution.fighters.length,
        });

        const summary = await startSimulationForRoster({
          initiatorUserId: resolution.initiatorUserId,
          fighters: resolution.fighters,
          seed,
        });

        logger.info("simulation start created", {
          path: "/simulations",
          correlationId,
          fighterCount: resolution.fighters.length,
          simulationId: summary.simulationId,
          broadcastId: summary.broadcastId,
          status: summary.status,
          seed,
        });

        return {
          simulationId: summary.simulationId,
          broadcastId: summary.broadcastId,
          status: summary.status,
        };
      } catch (error) {
        if (error instanceof SimulationStartInputError) {
          logger.warn("simulation start rejected", {
            path: "/simulations",
            correlationId,
            fighterIds,
            seed,
            error: error.message,
          });
          return status(error.statusCode === 404 ? 404 : 400, error.message);
        }

        logger.error("simulation start endpoint failed", {
          path: "/simulations",
          correlationId,
          fighterIds,
          seed,
          error: error instanceof Error ? error.message : String(error),
        });
        return status(500, "Unable to start simulation.");
      }
    },
    {
      body: simulationStartRequestSchema,
      response: {
        200: simulationStartResponseSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
        404: t.String(),
        500: t.String(),
      },
    },
  )
  .get(
    "/:id/status",
    async ({ params, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const summary = await getSimulationStatusForBroadcast({
        userId: auth.userId,
        broadcastId: params.id ?? "",
      });
      if (!summary) {
        return status(404, "Simulation not found.");
      }
      return summary;
    },
    {
      params: simulationIdPathParamsSchema,
      response: {
        200: simulationStatusSnapshotSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  )
  .get(
    "/:id/replay",
    async ({ params, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const replay = await getReplayForBroadcast({
        userId: auth.userId,
        broadcastId: params.id ?? "",
      });
      if (!replay) {
        return status(404, "Simulation not found.");
      }
      return replay;
    },
    {
      params: simulationIdPathParamsSchema,
      response: {
        200: simulationReplaySnapshotSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  )
  .get(
    "/:id",
    async ({ params, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const simulation = await getSimulationDetails({
        userId: auth.userId,
        simulationId: params.id ?? "",
      });
      if (!simulation) {
        return status(404, "Simulation not found.");
      }
      return simulation;
    },
    {
      params: simulationIdPathParamsSchema,
      response: {
        200: simulationDetailsSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  );
