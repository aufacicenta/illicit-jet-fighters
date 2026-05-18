import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { env } from "./config/env";
import { logServerStartup, withLogging } from "./plugins/logging";
import { fighterSessionRoutes } from "./routes/fighters";
import { generateRoutes } from "./routes/generate";
import { pipelineRoutes } from "./routes/pipeline";
import { agentRoutes, assetRoutes } from "./routes/storage";
import { wsHandler } from "./ws";

const PORT = env.PORT;
const HOST = env.HOST;

const guardedHttp = new Elysia({ name: "guarded-http" })
  .use(fighterSessionRoutes)
  .use(pipelineRoutes)
  .use(assetRoutes)
  .use(agentRoutes)
  .use(generateRoutes);

const app = withLogging(new Elysia())
  .use(
    cors({
      origin: "http://localhost:5174",
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "OPTIONS"],
    }),
  )
  .get("/health", () => ({ ok: true }))
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
