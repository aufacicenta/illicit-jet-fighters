import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { env } from "./config/env";
import { logServerStartup, withLogging } from "./plugins/logging";
import { arenaRoutes } from "./routes/arena";
import { battlefieldPipelineRoutes } from "./routes/battlefield-pipeline";
import { battlefieldSessionRoutes } from "./routes/battlefields";
import { broadcastRoutes } from "./routes/broadcasts";
import { costRoutes } from "./routes/costs";
import { fighterSessionRoutes } from "./routes/fighters";
import { generateRoutes } from "./routes/generate";
import { internalWalletRoutes } from "./routes/internal/wallet";
import { pipelineRoutes } from "./routes/pipeline";
import { publicFighterRoutes } from "./routes/public/fighters";
import { simulationRoutes } from "./routes/simulations";
import { agentRoutes, assetRoutes } from "./routes/storage";
import { walletRoutes } from "./routes/wallet";
import { wsHandler } from "./ws";
import { broadcastWsHandler } from "./ws/broadcast";

const PORT = env.PORT;
const HOST = env.HOST;

const guardedHttp = new Elysia({ name: "guarded-http" })
  .use(fighterSessionRoutes)
  .use(battlefieldSessionRoutes)
  .use(costRoutes)
  .use(pipelineRoutes)
  .use(battlefieldPipelineRoutes)
  .use(arenaRoutes)
  .use(simulationRoutes)
  .use(broadcastRoutes)
  .use(assetRoutes)
  .use(agentRoutes)
  .use(walletRoutes)
  .use(generateRoutes);

const app = withLogging(new Elysia())
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
    }),
  )
  .get("/health", () => ({ ok: true }))
  .use(publicFighterRoutes)
  .use(internalWalletRoutes)
  .use(broadcastWsHandler)
  .use(wsHandler)
  .use(guardedHttp);

app.listen(
  {
    port: PORT,
    hostname: HOST,
  },
  (server) => {
    logServerStartup(app, server);
  },
);

export type App = typeof app;
