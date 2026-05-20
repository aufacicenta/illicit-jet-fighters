import { Elysia } from "elysia";

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
);
