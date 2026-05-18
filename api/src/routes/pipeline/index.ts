import { pipelineStartSchema } from "@ijf/shared";
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
  generateSpecsheetFromCharacterDescription,
  serializeClientPipelineState,
  startPipeline,
} from "../../lib/pipeline-runner";
import { requireBearerAuth } from "../../lib/require-bearer-auth";
import type { PipelineSpecsheetRequest, PipelineStartResponse } from "./types";

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
  .get("/:id/state", async ({ params, request, headers, status }) => {
    const auth = await requireBearerAuth(request, headers);
    const resolution = await resolveFighterAccess(auth.userId, params.id);
    if ("error" in resolution) {
      return status(404, resolution.error);
    }

    const snapshot = await serializeClientPipelineState(resolution.fighterKey);
    if (!snapshot) {
      return status(500, "Unable to load pipeline state.");
    }

    return {
      ...snapshot,
      briefing: resolution.briefing,
    };
  })
  .post("/start", async ({ body, request, headers, status }) => {
    let payload;
    try {
      payload = pipelineStartSchema.parse(body);
    } catch {
      return status(400, "Invalid pipeline start payload.");
    }

    const auth = await requireBearerAuth(request, headers);
    const resolution = await resolveFighterAccess(auth.userId, String(payload.id));
    if ("error" in resolution) {
      return status(404, resolution.error);
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

    return { status: "started" } satisfies PipelineStartResponse;
  })
  .post(
    "/specsheet",
    async ({ body, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const payload = body as PipelineSpecsheetRequest;
      const resolution = await resolveFighterAccess(auth.userId, String(payload.id));
      if ("error" in resolution) {
        return status(404, resolution.error);
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
      body: t.Object({
        id: t.Number(),
        characterDescription: t.String(),
      }),
    },
  );
