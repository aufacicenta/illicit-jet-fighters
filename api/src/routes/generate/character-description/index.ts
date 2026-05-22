import { Elysia } from "elysia";

import { createCorrelationId } from "../../../lib/correlation-id";
import {
  generateCharacterDescription,
  generateCharacterDescriptionRefine,
} from "../../../lib/generate";
import { withCorrelationContext } from "../../../lib/log-context";
import { logger } from "../../../lib/logger";
import { requireBearerAuth } from "../../../lib/require-bearer-auth";
import type {
  CharacterDescriptionRefineRequest,
  CharacterDescriptionRequest,
  CharacterDescriptionResponse,
} from "./types";

export const characterDescriptionRoute = new Elysia()
  .post("/character-description", async ({ body, request, headers }) => {
    const auth = await requireBearerAuth(request, headers);
    const startedAt = Date.now();
    const correlationId = createCorrelationId("generate-character-description");
    const { prompt } = body as CharacterDescriptionRequest;
    logger.info(
      "generate character description requested",
      withCorrelationContext(correlationId, { path: "/generate/character-description" }),
    );
    try {
      const generated = await generateCharacterDescription(prompt, undefined, {
        userId: auth.userId,
        sectionId: "character-description",
        correlationId,
      });
      logger.info(
        "generate character description completed",
        withCorrelationContext(correlationId, {
          path: "/generate/character-description",
          durationMs: Date.now() - startedAt,
          promptLength: prompt.length,
          model: generated.model,
        }),
      );
      return generated satisfies CharacterDescriptionResponse;
    } catch (error) {
      logger.error(
        "generate character description failed",
        withCorrelationContext(correlationId, {
          path: "/generate/character-description",
          durationMs: Date.now() - startedAt,
          promptLength: prompt.length,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  })
  .post("/character-description/refine", async ({ body, request, headers }) => {
    const auth = await requireBearerAuth(request, headers);
    const startedAt = Date.now();
    const correlationId = createCorrelationId("generate-character-description-refine");
    const { message, history } = body as CharacterDescriptionRefineRequest;
    logger.info(
      "refine character description requested",
      withCorrelationContext(correlationId, { path: "/generate/character-description/refine" }),
    );
    try {
      const refined = await generateCharacterDescriptionRefine(history, message, {
        userId: auth.userId,
        sectionId: "character-description",
        correlationId,
      });
      logger.info(
        "refine character description completed",
        withCorrelationContext(correlationId, {
          path: "/generate/character-description/refine",
          durationMs: Date.now() - startedAt,
          messageLength: message.length,
          historyLength: history.length,
          model: refined.model,
        }),
      );
      return refined;
    } catch (error) {
      logger.error(
        "refine character description failed",
        withCorrelationContext(correlationId, {
          path: "/generate/character-description/refine",
          durationMs: Date.now() - startedAt,
          messageLength: message.length,
          historyLength: history.length,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  });
