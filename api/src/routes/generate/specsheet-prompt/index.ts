import { Elysia } from "elysia";

import { createCorrelationId } from "../../../lib/correlation-id";
import { generateSpecsheetPrompt, generateSpecsheetPromptRefine } from "../../../lib/generate";
import { withCorrelationContext } from "../../../lib/log-context";
import { logger } from "../../../lib/logger";
import { requireBearerAuth } from "../../../lib/require-bearer-auth";
import type {
  SpecsheetPromptRefineRequest,
  SpecsheetPromptRequest,
  SpecsheetPromptResponse,
} from "./types";

export const specsheetPromptRoute = new Elysia()
  .post("/specsheet-prompt", async ({ body, request, headers }) => {
    await requireBearerAuth(request, headers);
    const startedAt = Date.now();
    const correlationId = createCorrelationId("generate-specsheet-prompt");
    const { characterDescription } = body as SpecsheetPromptRequest;
    logger.info(
      "generate specsheet prompt requested",
      withCorrelationContext(correlationId, { path: "/generate/specsheet-prompt" }),
    );
    try {
      const generated = await generateSpecsheetPrompt(characterDescription);
      logger.info(
        "generate specsheet prompt completed",
        withCorrelationContext(correlationId, {
          path: "/generate/specsheet-prompt",
          durationMs: Date.now() - startedAt,
          descriptionLength: characterDescription.length,
          model: generated.model,
        }),
      );
      return generated satisfies SpecsheetPromptResponse;
    } catch (error) {
      logger.error(
        "generate specsheet prompt failed",
        withCorrelationContext(correlationId, {
          path: "/generate/specsheet-prompt",
          durationMs: Date.now() - startedAt,
          descriptionLength: characterDescription.length,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  })
  .post("/specsheet-prompt/refine", async ({ body, request, headers }) => {
    await requireBearerAuth(request, headers);
    const startedAt = Date.now();
    const correlationId = createCorrelationId("generate-specsheet-prompt-refine");
    const { message, history } = body as SpecsheetPromptRefineRequest;
    logger.info(
      "refine specsheet prompt requested",
      withCorrelationContext(correlationId, { path: "/generate/specsheet-prompt/refine" }),
    );
    try {
      const refined = await generateSpecsheetPromptRefine(history, message);
      logger.info(
        "refine specsheet prompt completed",
        withCorrelationContext(correlationId, {
          path: "/generate/specsheet-prompt/refine",
          durationMs: Date.now() - startedAt,
          messageLength: message.length,
          historyLength: history.length,
          model: refined.model,
        }),
      );
      return refined;
    } catch (error) {
      logger.error(
        "refine specsheet prompt failed",
        withCorrelationContext(correlationId, {
          path: "/generate/specsheet-prompt/refine",
          durationMs: Date.now() - startedAt,
          messageLength: message.length,
          historyLength: history.length,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  });
