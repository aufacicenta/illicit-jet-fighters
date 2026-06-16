import { broadcastDetailsSnapshotSchema, broadcastIdPathParamsSchema } from "@ijf/shared";
import { Elysia, t } from "elysia";

import { getBroadcastDetails } from "../../lib/simulation-orchestrator";

// Broadcasts are public spectator content, so this read endpoint intentionally requires no auth.
export const broadcastRoutes = new Elysia({ prefix: "/broadcasts" }).get(
  "/:id",
  async ({ params, status }) => {
    const broadcast = await getBroadcastDetails({
      broadcastId: params.id,
    });
    if (!broadcast) {
      return status(404, "Broadcast not found.");
    }
    return broadcast;
  },
  {
    params: broadcastIdPathParamsSchema,
    response: {
      200: broadcastDetailsSnapshotSchema,
      404: t.String(),
    },
  },
);
