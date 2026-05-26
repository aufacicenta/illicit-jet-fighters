import {
  type SpecsheetImageRequest,
  specsheetImageRequestSchema,
  type SpecsheetImageResponse,
  specsheetImageResponseSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import { createCorrelationId } from "../../../lib/correlation-id";
import { generateSpecsheetImage } from "../../../lib/generate";
import { withCorrelationContext } from "../../../lib/log-context";
import { logger } from "../../../lib/logger";
import { requireBearerAuth } from "../../../lib/require-bearer-auth";

export const specsheetImageRoute = new Elysia()
  .post(
    "/specsheet-image",
    async ({ body, request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const startedAt = Date.now();
      const correlationId = createCorrelationId("generate-specsheet-image");
      const { prompt } = body as SpecsheetImageRequest;
      logger.info(
        "generate specsheet image requested",
        withCorrelationContext(correlationId, { path: "/generate/specsheet-image" }),
      );
      try {
        const generated = await generateSpecsheetImage(prompt, {
          userId: auth.userId,
          sectionId: "specsheet-image",
          correlationId,
        });
        logger.info(
          "generate specsheet image completed",
          withCorrelationContext(correlationId, {
            path: "/generate/specsheet-image",
            durationMs: Date.now() - startedAt,
            promptLength: prompt.length,
            model: generated.model,
            mimeType: generated.mimeType,
          }),
        );
        return generated satisfies SpecsheetImageResponse;
      } catch (error) {
        logger.error(
          "generate specsheet image failed",
          withCorrelationContext(correlationId, {
            path: "/generate/specsheet-image",
            durationMs: Date.now() - startedAt,
            promptLength: prompt.length,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        throw error;
      }
    },
    {
      body: specsheetImageRequestSchema,
      response: {
        200: specsheetImageResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .post(
    "/specsheet-image/refine",
    async ({ body, request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const startedAt = Date.now();
      const correlationId = createCorrelationId("generate-specsheet-image-refine");
      const { prompt } = body as SpecsheetImageRequest;
      logger.info(
        "refine specsheet image requested",
        withCorrelationContext(correlationId, { path: "/generate/specsheet-image/refine" }),
      );
      try {
        const generated = await generateSpecsheetImage(prompt, {
          userId: auth.userId,
          sectionId: "specsheet-image",
          correlationId,
        });
        logger.info(
          "refine specsheet image completed",
          withCorrelationContext(correlationId, {
            path: "/generate/specsheet-image/refine",
            durationMs: Date.now() - startedAt,
            promptLength: prompt.length,
            model: generated.model,
            mimeType: generated.mimeType,
          }),
        );
        return generated;
      } catch (error) {
        logger.error(
          "refine specsheet image failed",
          withCorrelationContext(correlationId, {
            path: "/generate/specsheet-image/refine",
            durationMs: Date.now() - startedAt,
            promptLength: prompt.length,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        throw error;
      }
    },
    {
      body: specsheetImageRequestSchema,
      response: {
        200: specsheetImageResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  );
