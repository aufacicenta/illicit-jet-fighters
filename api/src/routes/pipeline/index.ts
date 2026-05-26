import {
  fighterIdPathParamsSchema,
  pipelineIdRequestSchema,
  pipelineSpecsheetRequestSchema,
  pipelineStartResponseSchema,
  pipelineStartSchema,
  pipelineStateSnapshotSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import { createCorrelationId } from "../../lib/correlation-id";
import {
  fighterKeyFromId,
  getOwnedFighter,
  parseFighterIdParam,
  saveFighterBriefing,
} from "../../lib/fighter-access";
import { logger } from "../../lib/logger";
import {
  bindPipelineTenant,
  generateAgentCodeFromCharacterDescription,
  generateSpecsheetFromCharacterDescription,
  generateSpritesheetImageFromPrompt,
  generateStrikecraftSpecsheetImageFromPrompt,
  generateStrikecraftSpriteImageFromPrompt,
  serializeClientPipelineState,
  startPipeline,
} from "../../lib/pipeline-runner";
import { requireBearerAuth } from "../../lib/require-bearer-auth";
import type { PipelineStartResponse } from "./types";

const resolveFighterAccess = async (authUserId: string, rawId: string) => {
  const fighterId = parseFighterIdParam(rawId);
  if (!fighterId) {
    return { error: "Invalid fighter id." as const };
  }

  const owned = await getOwnedFighter(fighterId, authUserId);
  if (!owned) {
    return { error: "Fighter not found." as const };
  }

  const fighterKey = fighterKeyFromId(fighterId);
  bindPipelineTenant(fighterKey, { userId: authUserId, fighterId });
  return { fighterId, fighterKey, briefing: owned.briefing ?? null };
};

export const pipelineRoutes = new Elysia({ prefix: "/pipeline" })
  .get(
    "/:id/state",
    async ({ params, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const resolution = await resolveFighterAccess(auth.userId, params.id ?? "");
      if ("error" in resolution) {
        return status(404, resolution.error ?? "Fighter not found.");
      }

      const snapshot = await serializeClientPipelineState(resolution.fighterKey);
      if (!snapshot) {
        return status(500, "Unable to load pipeline state.");
      }

      return pipelineStateSnapshotSchema.parse({
        ...snapshot,
        briefing: resolution.briefing,
      });
    },
    {
      params: fighterIdPathParamsSchema,
      response: {
        200: pipelineStateSnapshotSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
        500: t.String(),
      },
    },
  )
  .post(
    "/start",
    async ({ body, request, headers, status }) => {
      const payload = body;
      const auth = await requireBearerAuth(request, headers);
      const resolution = await resolveFighterAccess(auth.userId, String(payload.id));
      if ("error" in resolution) {
        return status(404, resolution.error ?? "Fighter not found.");
      }

      await saveFighterBriefing(resolution.fighterId, payload.prompt);

      const correlationId = createCorrelationId("pipeline-start");
      logger.info("pipeline start endpoint hit", {
        path: "/pipeline/start",
        fighterId: resolution.fighterId,
        correlationId,
        promptLength: typeof payload.prompt === "string" ? payload.prompt.length : undefined,
      });

      void startPipeline(resolution.fighterKey, payload.prompt, correlationId)
        .then(() => {
          logger.info("pipeline start endpoint async execution completed", {
            path: "/pipeline/start",
            fighterId: resolution.fighterId,
            correlationId,
          });
        })
        .catch((error) => {
          logger.error("pipeline start endpoint async execution failed", {
            path: "/pipeline/start",
            fighterId: resolution.fighterId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return pipelineStartResponseSchema.parse({
        status: "started",
      }) satisfies PipelineStartResponse;
    },
    {
      body: pipelineStartSchema,
      response: {
        200: pipelineStartResponseSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  )
  .post(
    "/specsheet",
    async ({ body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const payload = body;
      const resolution = await resolveFighterAccess(auth.userId, String(payload.id));
      if ("error" in resolution) {
        return status(404, resolution.error ?? "Fighter not found.");
      }

      const correlationId = createCorrelationId("pipeline-specsheet");
      logger.info("pipeline specsheet endpoint hit", {
        path: "/pipeline/specsheet",
        fighterId: resolution.fighterId,
        correlationId,
        descriptionLength:
          typeof payload.characterDescription === "string"
            ? payload.characterDescription.length
            : undefined,
      });

      void generateSpecsheetFromCharacterDescription(
        resolution.fighterKey,
        payload.characterDescription,
        correlationId,
      )
        .then(() => {
          logger.info("pipeline specsheet endpoint async execution completed", {
            path: "/pipeline/specsheet",
            fighterId: resolution.fighterId,
            correlationId,
          });
        })
        .catch((error) => {
          logger.error("pipeline specsheet endpoint async execution failed", {
            path: "/pipeline/specsheet",
            fighterId: resolution.fighterId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return { status: "started" } satisfies PipelineStartResponse;
    },
    {
      body: pipelineSpecsheetRequestSchema,
      response: {
        200: pipelineStartResponseSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  )
  .post(
    "/agent-code",
    async ({ body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const payload = body;
      const resolution = await resolveFighterAccess(auth.userId, String(payload.id));
      if ("error" in resolution) {
        return status(404, resolution.error ?? "Fighter not found.");
      }

      const correlationId = createCorrelationId("pipeline-agent-code");
      logger.info("pipeline agent-code endpoint hit", {
        path: "/pipeline/agent-code",
        fighterId: resolution.fighterId,
        correlationId,
      });

      void generateAgentCodeFromCharacterDescription(
        resolution.fighterKey,
        undefined,
        correlationId,
      )
        .then(() => {
          logger.info("pipeline agent-code endpoint async execution completed", {
            path: "/pipeline/agent-code",
            fighterId: resolution.fighterId,
            correlationId,
          });
        })
        .catch((error) => {
          logger.error("pipeline agent-code endpoint async execution failed", {
            path: "/pipeline/agent-code",
            fighterId: resolution.fighterId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return { status: "started" } satisfies PipelineStartResponse;
    },
    {
      body: pipelineIdRequestSchema,
      response: {
        200: pipelineStartResponseSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  )
  .post(
    "/spritesheet-image",
    async ({ body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const payload = body;
      const resolution = await resolveFighterAccess(auth.userId, String(payload.id));
      if ("error" in resolution) {
        return status(404, resolution.error ?? "Fighter not found.");
      }

      const correlationId = createCorrelationId("pipeline-spritesheet-image");
      logger.info("pipeline spritesheet-image endpoint hit", {
        path: "/pipeline/spritesheet-image",
        fighterId: resolution.fighterId,
        correlationId,
      });

      void generateSpritesheetImageFromPrompt(resolution.fighterKey, correlationId)
        .then(() => {
          logger.info("pipeline spritesheet-image endpoint async execution completed", {
            path: "/pipeline/spritesheet-image",
            fighterId: resolution.fighterId,
            correlationId,
          });
        })
        .catch((error) => {
          logger.error("pipeline spritesheet-image endpoint async execution failed", {
            path: "/pipeline/spritesheet-image",
            fighterId: resolution.fighterId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return { status: "started" } satisfies PipelineStartResponse;
    },
    {
      body: pipelineIdRequestSchema,
      response: {
        200: pipelineStartResponseSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  )
  .post(
    "/strikecraft-specsheet-image",
    async ({ body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const payload = body;
      const resolution = await resolveFighterAccess(auth.userId, String(payload.id));
      if ("error" in resolution) {
        return status(404, resolution.error ?? "Fighter not found.");
      }

      const correlationId = createCorrelationId("pipeline-strikecraft-specsheet-image");
      logger.info("pipeline strikecraft-specsheet-image endpoint hit", {
        path: "/pipeline/strikecraft-specsheet-image",
        fighterId: resolution.fighterId,
        correlationId,
      });

      void generateStrikecraftSpecsheetImageFromPrompt(resolution.fighterKey, correlationId)
        .then(() => {
          logger.info("pipeline strikecraft-specsheet-image endpoint async execution completed", {
            path: "/pipeline/strikecraft-specsheet-image",
            fighterId: resolution.fighterId,
            correlationId,
          });
        })
        .catch((error) => {
          logger.error("pipeline strikecraft-specsheet-image endpoint async execution failed", {
            path: "/pipeline/strikecraft-specsheet-image",
            fighterId: resolution.fighterId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return { status: "started" } satisfies PipelineStartResponse;
    },
    {
      body: pipelineIdRequestSchema,
      response: {
        200: pipelineStartResponseSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  )
  .post(
    "/strikecraft-sprite-image",
    async ({ body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const payload = body;
      const resolution = await resolveFighterAccess(auth.userId, String(payload.id));
      if ("error" in resolution) {
        return status(404, resolution.error ?? "Fighter not found.");
      }

      const correlationId = createCorrelationId("pipeline-strikecraft-sprite-image");
      logger.info("pipeline strikecraft-sprite-image endpoint hit", {
        path: "/pipeline/strikecraft-sprite-image",
        fighterId: resolution.fighterId,
        correlationId,
      });

      void generateStrikecraftSpriteImageFromPrompt(resolution.fighterKey, correlationId)
        .then(() => {
          logger.info("pipeline strikecraft-sprite-image endpoint async execution completed", {
            path: "/pipeline/strikecraft-sprite-image",
            fighterId: resolution.fighterId,
            correlationId,
          });
        })
        .catch((error) => {
          logger.error("pipeline strikecraft-sprite-image endpoint async execution failed", {
            path: "/pipeline/strikecraft-sprite-image",
            fighterId: resolution.fighterId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return { status: "started" } satisfies PipelineStartResponse;
    },
    {
      body: pipelineIdRequestSchema,
      response: {
        200: pipelineStartResponseSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  );
