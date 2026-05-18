import { Elysia } from "elysia";

import { createCorrelationId } from "../../../lib/correlation-id";
import { generateSpecsheetImage } from "../../../lib/generate";
import { withCorrelationContext } from "../../../lib/log-context";
import { logger } from "../../../lib/logger";
import type { SpecsheetImageRequest, SpecsheetImageResponse } from "./types";

export const specsheetImageRoute = new Elysia()
  .post("/specsheet-image", async ({ body }) => {
    const startedAt = Date.now();
    const correlationId = createCorrelationId("generate-specsheet-image");
    const { prompt } = body as SpecsheetImageRequest;
    logger.info(
      "generate specsheet image requested",
      withCorrelationContext(correlationId, { path: "/generate/specsheet-image" }),
    );
    try {
      const generated = await generateSpecsheetImage(prompt);
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
  })
  .post("/specsheet-image/refine", async ({ body }) => {
    const startedAt = Date.now();
    const correlationId = createCorrelationId("generate-specsheet-image-refine");
    const { prompt } = body as SpecsheetImageRequest;
    logger.info(
      "refine specsheet image requested",
      withCorrelationContext(correlationId, { path: "/generate/specsheet-image/refine" }),
    );
    try {
      const generated = await generateSpecsheetImage(prompt);
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
  });
