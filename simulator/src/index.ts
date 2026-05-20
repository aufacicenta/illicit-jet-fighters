import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";

import { simulationManager } from "./simulation-manager";
import { registerBroadcastSocket, unregisterBroadcastSocket } from "./ws/broadcast-hub";

export { simulationManager } from "./simulation-manager";
export { registerBroadcastSocket, unregisterBroadcastSocket } from "./ws/broadcast-hub";

export const simulatorApp = new Elysia()
  .use(
    cors({
      origin: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "OPTIONS"],
    }),
  )
  .get("/health", () => ({ ok: true }))
  .post(
    "/simulations",
    ({ body }) => {
      const seed =
        typeof body.seed === "number" && Number.isFinite(body.seed) ? body.seed : Date.now();
      const summary = simulationManager.startSimulation({
        broadcastId: body.broadcastId,
        players: body.players,
        seed,
        battlefield: body.battlefield,
        pickupConfig: body.pickupConfig,
      });
      return {
        broadcastId: summary.broadcastId,
        status: summary.status,
      };
    },
    {
      body: t.Object({
        broadcastId: t.String(),
        seed: t.Optional(t.Number()),
        players: t.Array(
          t.Object({
            id: t.String(),
            code: t.String(),
          }),
        ),
        battlefield: t.Optional(t.Any()),
        pickupConfig: t.Optional(t.Any()),
      }),
    },
  )
  .get("/simulations/:id/status", ({ params, set }) => {
    const summary = simulationManager.getSummary(params.id);
    if (!summary) {
      set.status = 404;
      return { message: "Simulation not found." };
    }
    return summary;
  })
  .get("/simulations/:id/replay", ({ params, set }) => {
    const replay = simulationManager.getReplay(params.id);
    if (!replay) {
      set.status = 404;
      return { message: "Simulation not found." };
    }
    return { frames: replay };
  })
  .ws("/broadcast/:id", {
    open(ws) {
      registerBroadcastSocket(ws.data.params.id, ws);
    },
    close(ws) {
      unregisterBroadcastSocket(ws.data.params.id, ws);
    },
  });

if (import.meta.main) {
  const port = Number(Bun.env.SIMULATOR_PORT || 4100);
  simulatorApp.listen(port, () => {
    console.info(`Simulator listening on ${port}`);
  });
}
