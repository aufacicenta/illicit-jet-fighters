import {
  battlefieldIdPathParamsSchema,
  battlefieldPipelineStartSchema,
  battlefieldPipelineStateSnapshotSchema,
  pipelineIdRequestSchema,
  pipelineStartResponseSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import {
  battlefieldKeyFromId,
  getOwnedBattlefield,
  parseBattlefieldIdParam,
  saveBattlefieldBriefing,
} from "../../lib/battlefield-access";
import {
  bindBattlefieldPipelineTenant,
  generateBattlefieldConfigFromDescription,
  generateBattlefieldSheetFromDescription,
  serializeClientBattlefieldPipelineState,
  startBattlefieldPipeline,
} from "../../lib/battlefield-pipeline-runner";
import { createCorrelationId } from "../../lib/correlation-id";
import { logger } from "../../lib/logger";
import { requireBearerAuth } from "../../lib/require-bearer-auth";
import type { BattlefieldPipelineStartResponse } from "./types";

const resolveBattlefieldAccess = async (authUserId: string, rawId: string) => {
  const battlefieldId = parseBattlefieldIdParam(rawId);
  if (!battlefieldId) {
    return { error: "Invalid battlefield id." as const };
  }

  const owned = await getOwnedBattlefield(battlefieldId, authUserId);
  if (!owned) {
    return { error: "Battlefield not found." as const };
  }

  const battlefieldKey = battlefieldKeyFromId(battlefieldId);
  bindBattlefieldPipelineTenant(battlefieldKey, { userId: authUserId, battlefieldId });
  return { battlefieldId, battlefieldKey, briefing: owned.briefing ?? null };
};

export const battlefieldPipelineRoutes = new Elysia({ prefix: "/battlefield-pipeline" })
  .get(
    "/:id/state",
    async ({ params, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const resolution = await resolveBattlefieldAccess(auth.userId, params.id ?? "");
      if ("error" in resolution) {
        return status(404, resolution.error ?? "Battlefield not found.");
      }

      const snapshot = await serializeClientBattlefieldPipelineState(resolution.battlefieldKey);
      if (!snapshot) {
        return status(500, "Unable to load battlefield pipeline state.");
      }

      return battlefieldPipelineStateSnapshotSchema.parse({
        ...snapshot,
        briefing: resolution.briefing,
      });
    },
    {
      params: battlefieldIdPathParamsSchema,
      response: {
        200: battlefieldPipelineStateSnapshotSchema,
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
      const resolution = await resolveBattlefieldAccess(auth.userId, String(payload.id));
      if ("error" in resolution) {
        return status(404, resolution.error ?? "Battlefield not found.");
      }

      await saveBattlefieldBriefing(resolution.battlefieldId, payload.prompt);

      const correlationId = createCorrelationId("battlefield-pipeline-start");
      logger.info("battlefield pipeline start endpoint hit", {
        path: "/battlefield-pipeline/start",
        battlefieldId: resolution.battlefieldId,
        correlationId,
        promptLength: typeof payload.prompt === "string" ? payload.prompt.length : undefined,
      });

      void startBattlefieldPipeline(resolution.battlefieldKey, payload.prompt, correlationId).catch(
        (error) => {
          logger.error("battlefield pipeline start endpoint async execution failed", {
            path: "/battlefield-pipeline/start",
            battlefieldId: resolution.battlefieldId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      );

      return pipelineStartResponseSchema.parse({
        status: "started",
      }) satisfies BattlefieldPipelineStartResponse;
    },
    {
      body: battlefieldPipelineStartSchema,
      response: {
        200: pipelineStartResponseSchema,
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  )
  .post(
    "/sheet",
    async ({ body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const payload = body;
      const resolution = await resolveBattlefieldAccess(auth.userId, String(payload.id));
      if ("error" in resolution) {
        return status(404, resolution.error ?? "Battlefield not found.");
      }

      const correlationId = createCorrelationId("battlefield-pipeline-sheet");
      void generateBattlefieldSheetFromDescription(resolution.battlefieldKey, correlationId).catch(
        (error) => {
          logger.error("battlefield pipeline sheet endpoint async execution failed", {
            path: "/battlefield-pipeline/sheet",
            battlefieldId: resolution.battlefieldId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      );

      return { status: "started" } satisfies BattlefieldPipelineStartResponse;
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
    "/config",
    async ({ body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const payload = body;
      const resolution = await resolveBattlefieldAccess(auth.userId, String(payload.id));
      if ("error" in resolution) {
        return status(404, resolution.error ?? "Battlefield not found.");
      }

      const correlationId = createCorrelationId("battlefield-pipeline-config");
      void generateBattlefieldConfigFromDescription(resolution.battlefieldKey, correlationId).catch(
        (error) => {
          logger.error("battlefield pipeline config endpoint async execution failed", {
            path: "/battlefield-pipeline/config",
            battlefieldId: resolution.battlefieldId,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      );

      return { status: "started" } satisfies BattlefieldPipelineStartResponse;
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
