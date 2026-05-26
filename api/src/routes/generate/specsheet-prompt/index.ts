import {
  type SpecsheetPromptRefineRequest,
  specsheetPromptRefineRequestSchema,
  type SpecsheetPromptRequest,
  specsheetPromptRequestSchema,
  type SpecsheetPromptResponse,
  specsheetPromptResponseSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import { createCorrelationId } from "../../../lib/correlation-id";
import { generateSpecsheetPrompt, generateSpecsheetPromptRefine } from "../../../lib/generate";
import { withCorrelationContext } from "../../../lib/log-context";
import { logger } from "../../../lib/logger";
import { requireBearerAuth } from "../../../lib/require-bearer-auth";

export const specsheetPromptRoute = new Elysia()
  .post(
    "/specsheet-prompt",
    async ({ body, request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const startedAt = Date.now();
      const correlationId = createCorrelationId("generate-specsheet-prompt");
      const { characterDescription } = body as SpecsheetPromptRequest;
      logger.info(
        "generate specsheet prompt requested",
        withCorrelationContext(correlationId, { path: "/generate/specsheet-prompt" }),
      );
      try {
        const generated = await generateSpecsheetPrompt(characterDescription, undefined, {
          userId: auth.userId,
          sectionId: "specsheet-prompt",
          correlationId,
        });
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
    },
    {
      body: specsheetPromptRequestSchema,
      response: {
        200: specsheetPromptResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .post(
    "/specsheet-prompt/refine",
    async ({ body, request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const startedAt = Date.now();
      const correlationId = createCorrelationId("generate-specsheet-prompt-refine");
      const { message, history } = body as SpecsheetPromptRefineRequest;
      logger.info(
        "refine specsheet prompt requested",
        withCorrelationContext(correlationId, { path: "/generate/specsheet-prompt/refine" }),
      );
      try {
        const refined = await generateSpecsheetPromptRefine(history, message, {
          userId: auth.userId,
          sectionId: "specsheet-prompt",
          correlationId,
        });
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
    },
    {
      body: specsheetPromptRefineRequestSchema,
      response: {
        200: specsheetPromptResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  );
