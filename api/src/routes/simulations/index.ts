import {
  simulationIdPathParamsSchema,
  simulationReplaySnapshotSchema,
  simulationStatusSnapshotSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import {
  getReplayForBroadcast,
  getSimulationStatusForBroadcast,
} from "../../lib/simulation-orchestrator";

// Broadcasts are public spectator content, so these read endpoints intentionally require no auth.
export const simulationRoutes = new Elysia({ prefix: "/simulations" })
  .get(
    "/:id/status",
    async ({ params, status }) => {
      const summary = await getSimulationStatusForBroadcast({
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
        404: t.String(),
      },
    },
  )
  .get(
    "/:id/replay",
    async ({ params, status }) => {
      const replay = await getReplayForBroadcast({
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
        404: t.String(),
      },
    },
  );
