import { Elysia } from "elysia";

import { createCorrelationId } from "../../lib/correlation-id";
import { logger } from "../../lib/logger";
import {
  generateSpecsheetFromCharacterDescription,
  startPipeline,
} from "../../lib/pipeline-runner";
import type {
  PipelineSpecsheetRequest,
  PipelineStartRequest,
  PipelineStartResponse,
} from "./types";

export const pipelineRoute = new Elysia({ prefix: "/pipeline" })
  .post("/start", ({ body }) => {
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
  })
  .post("/specsheet", ({ body }) => {
    const { fighterId, characterDescription } = body as PipelineSpecsheetRequest;
    const correlationId = createCorrelationId("pipeline-specsheet");
    logger.info("pipeline specsheet endpoint hit", {
      path: "/pipeline/specsheet",
      fighterId,
      correlationId,
      descriptionLength:
        typeof characterDescription === "string" ? characterDescription.length : undefined,
    });

    if (!fighterId || !characterDescription) {
      logger.warn("pipeline specsheet endpoint validation failed", {
        path: "/pipeline/specsheet",
        fighterId,
        correlationId,
        hasCharacterDescription: Boolean(characterDescription),
      });
    }

    void generateSpecsheetFromCharacterDescription(fighterId, characterDescription, correlationId)
      .then(() => {
        logger.info("pipeline specsheet endpoint async execution completed", {
          path: "/pipeline/specsheet",
          fighterId,
          correlationId,
        });
      })
      .catch((error) => {
        logger.error("pipeline specsheet endpoint async execution failed", {
          path: "/pipeline/specsheet",
          fighterId,
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    logger.debug("pipeline specsheet endpoint response sent", {
      path: "/pipeline/specsheet",
      fighterId,
      correlationId,
      status: "started",
    });
    return { status: "started" } satisfies PipelineStartResponse;
  });
