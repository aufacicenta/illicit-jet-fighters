import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { logServerStartup, withLogging } from "./plugins/logging";
import { generateRoutes } from "./routes/generate";
import { pipelineRoute } from "./routes/pipeline";
import { wsHandler } from "./ws";

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST ?? "0.0.0.0";

const app = withLogging(new Elysia())
  .use(cors({ origin: "http://localhost:5174" }))
  .use(wsHandler)
  .use(generateRoutes)
  .use(pipelineRoute)
  .get("/health", () => ({ ok: true }));

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
