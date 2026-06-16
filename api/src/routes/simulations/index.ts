import {
  simulationIdPathParamsSchema,
  simulationReplaySnapshotSchema,
  simulationStatusSnapshotSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import { requireBearerAuth } from "../../lib/require-bearer-auth";
import {
  getReplayForBroadcast,
  getSimulationStatusForBroadcast,
} from "../../lib/simulation-orchestrator";

export const simulationRoutes = new Elysia({ prefix: "/simulations" })
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
  );
