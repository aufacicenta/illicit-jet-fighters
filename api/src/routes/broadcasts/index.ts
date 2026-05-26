import { broadcastDetailsSnapshotSchema, broadcastIdPathParamsSchema } from "@ijf/shared";
import { Elysia, t } from "elysia";

import { requireBearerAuth } from "../../lib/require-bearer-auth";
import { getBroadcastDetails } from "../../lib/simulation-orchestrator";

export const broadcastRoutes = new Elysia({ prefix: "/broadcasts" }).get(
  "/:id",
  async ({ params, request, headers, status }) => {
    const auth = await requireBearerAuth(request, headers);
    const broadcast = await getBroadcastDetails({
      userId: auth.userId,
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
      401: t.String(),
      403: t.String(),
      404: t.String(),
    },
  },
);
