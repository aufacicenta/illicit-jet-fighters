import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { generateRoutes } from "./routes/generate";
import { pipelineRoute } from "./routes/pipeline";
import { wsHandler } from "./ws";

new Elysia()
  .use(cors({ origin: "http://localhost:5174" }))
  .use(wsHandler)
  .use(generateRoutes)
  .use(pipelineRoute)
  .get("/health", () => ({ ok: true }))
  .listen(4000);
