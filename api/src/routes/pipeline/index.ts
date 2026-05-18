import { Elysia } from "elysia";

import { createCorrelationId } from "../../lib/correlation-id";
import { logger } from "../../lib/logger";
import { startPipeline } from "../../lib/pipeline-runner";
import type { PipelineStartRequest, PipelineStartResponse } from "./types";

export const pipelineRoute = new Elysia({ prefix: "/pipeline" }).post("/start", ({ body }) => {
  const { fighterId, prompt } = body as PipelineStartRequest;
  const correlationId = createCorrelationId("pipeline-start");
  logger.info("pipeline start endpoint hit", {
    path: "/pipeline/start",
    fighterId,
    correlationId,
    promptLength: typeof prompt === "string" ? prompt.length : undefined,
  });

  if (!fighterId || !prompt) {
    logger.warn("pipeline start endpoint validation failed", {
      path: "/pipeline/start",
      fighterId,
      correlationId,
      hasPrompt: Boolean(prompt),
    });
  }

  void startPipeline(fighterId, prompt, correlationId)
    .then(() => {
      logger.info("pipeline start endpoint async execution completed", {
        path: "/pipeline/start",
        fighterId,
        correlationId,
      });
    })
    .catch((error) => {
      logger.error("pipeline start endpoint async execution failed", {
        path: "/pipeline/start",
        fighterId,
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  logger.debug("pipeline start endpoint response sent", {
    path: "/pipeline/start",
    fighterId,
    correlationId,
    status: "started",
  });
  return { status: "started" } satisfies PipelineStartResponse;
});
