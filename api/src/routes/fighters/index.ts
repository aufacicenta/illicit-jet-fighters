import type { FighterAgentVersionsResponse, MyFightersResponse } from "@ijf/shared";
import {
  fighterAgentVersionsResponseSchema,
  fighterCheckpointResponseSchema,
  fighterIdPathParamsSchema,
  fighterIdResponseSchema,
  fighterIntakeResponseSchema,
  myFightersResponseSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import { listFighterAgentVersionsForOwnerAndFighter } from "../../lib/agent-version-repository";
import {
  getFighterCheckpointForSimulation,
  getLatestFighterCheckpointForOwner,
} from "../../lib/checkpoint-repository";
import {
  createFighterForUser,
  deleteOwnedFighter,
  fighterKeyFromId,
  getOwnedFighter,
  listOwnedFighters,
  parseFighterIdParam,
} from "../../lib/fighter-access";
import { resolveOwnedFighterPfpUrl, resolveOwnedFighterSpriteUrl } from "../../lib/fighter-assets";
import { resolveFighterForIntake } from "../../lib/fighter-intake";
import {
  bindPipelineTenant,
  buildFighterPreviewFromSnapshot,
  clearPipelineStateForFighter,
  serializeClientPipelineState,
} from "../../lib/pipeline-runner";
import { deleteObjectsByPrefix, getSignedReadUrl } from "../../lib/r2";
import { requireBearerAuth } from "../../lib/require-bearer-auth";
import { isInsufficientBalanceError } from "../../lib/wallet/route-errors";

const fighterStoragePrefix = (userId: string, fighterId: number) =>
  `users/${userId}/fighters/${String(fighterId)}/`;

export const fighterSessionRoutes = new Elysia({ prefix: "/fighters" })
  .post(
    "",
    async ({ request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const id = await createFighterForUser(auth.userId);
      return { id };
    },
    {
      response: {
        200: fighterIdResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .post(
    "/intake",
    async ({ request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);

      try {
        const result = await resolveFighterForIntake(auth.userId);
        return fighterIntakeResponseSchema.parse(result);
      } catch (error) {
        if (isInsufficientBalanceError(error)) {
          return status(402, error.message);
        }
        throw error;
      }
    },
    {
      response: {
        200: fighterIntakeResponseSchema,
        401: t.String(),
        402: t.String(),
        403: t.String(),
      },
    },
  )
  .get(
    "",
    async ({ request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const fighters = await listOwnedFighters(auth.userId);

      const hydrated = await Promise.all(
        fighters.map(async (fighter) => {
          const fighterKey = fighterKeyFromId(fighter.id);
          bindPipelineTenant(fighterKey, { userId: auth.userId, fighterId: fighter.id });
          const snapshot = await serializeClientPipelineState(fighterKey);

          const preview = snapshot
            ? buildFighterPreviewFromSnapshot(snapshot)
            : {
                characterDescription: null,
                specsheetPrompt: null,
                specsheetImageUrl: null,
                pfpUrl: null,
                status: "locked" as const,
              };

          const pfpUrl =
            preview.pfpUrl ?? (await resolveOwnedFighterPfpUrl(auth.userId, fighter.id));
          const spriteUrl = await resolveOwnedFighterSpriteUrl(auth.userId, fighter.id);

          return {
            id: fighter.id,
            slug: fighter.slug,
            name: fighter.name,
            briefing: fighter.briefing,
            arenaStatus: fighter.arenaStatus,
            createdAt: fighter.createdAt.toISOString(),
            updatedAt: fighter.updatedAt.toISOString(),
            characterDescription: preview.characterDescription,
            specsheetPrompt: preview.specsheetPrompt,
            specsheetImageUrl: preview.specsheetImageUrl,
            pfpUrl,
            spriteUrl,
            status: preview.status,
          };
        }),
      );

      return {
        fighters: hydrated,
      } satisfies MyFightersResponse;
    },
    {
      response: {
        200: myFightersResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .get(
    "/:id/agent-versions",
    async ({ params, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const fighterId = parseFighterIdParam(params.id);
      if (!fighterId) {
        return status(400, "Invalid fighter id.");
      }

      const ownedFighter = await getOwnedFighter(fighterId, auth.userId);
      if (!ownedFighter) {
        return status(404, "Fighter not found.");
      }

      const versions = await listFighterAgentVersionsForOwnerAndFighter({
        fighterId,
        userId: auth.userId,
      });
      const checkpointFlags = await Promise.all(
        versions.map((version) =>
          getLatestFighterCheckpointForOwner({
            fighterId,
            userId: auth.userId,
            agentVersionId: version.id,
          }),
        ),
      );

      return {
        versions: versions.map((version, index) => ({
          id: version.id,
          fighterId: version.fighterId,
          versionNumber: version.versionNumber,
          model: version.model,
          hasCheckpoint: checkpointFlags[index] !== null,
          createdAt: version.createdAt.toISOString(),
        })),
      } satisfies FighterAgentVersionsResponse;
    },
    {
      params: fighterIdPathParamsSchema,
      response: {
        200: fighterAgentVersionsResponseSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  )
  .get(
    "/:id/checkpoint",
    async ({ params, query, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const fighterId = parseFighterIdParam(params.id);
      if (!fighterId) {
        return status(400, "Invalid fighter id.");
      }

      const ownedFighter = await getOwnedFighter(fighterId, auth.userId);
      if (!ownedFighter) {
        return status(404, "Fighter not found.");
      }

      const simulationId =
        typeof query.simulationId === "string" && query.simulationId.trim().length > 0
          ? query.simulationId.trim()
          : null;

      const checkpoint = simulationId
        ? await getFighterCheckpointForSimulation({
            fighterId,
            userId: auth.userId,
            simulationId,
          })
        : await getLatestFighterCheckpointForOwner({
            fighterId,
            userId: auth.userId,
          });

      if (!checkpoint) {
        return status(404, "Checkpoint not found.");
      }

      const signedUrl = await getSignedReadUrl(checkpoint.objectKey);
      return {
        signedUrl,
        simulationId: checkpoint.simulationId,
        sizeBytes: checkpoint.sizeBytes,
        createdAt: checkpoint.createdAt.toISOString(),
      };
    },
    {
      params: fighterIdPathParamsSchema,
      query: t.Object({
        simulationId: t.Optional(t.String()),
      }),
      response: {
        200: fighterCheckpointResponseSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  )
  .delete(
    "/:id",
    async ({ params, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const fighterId = parseFighterIdParam(params.id);
      if (!fighterId) {
        return status(400, "Invalid fighter id.");
      }

      const ownedFighter = await getOwnedFighter(fighterId, auth.userId);
      if (!ownedFighter) {
        return status(404, "Fighter not found.");
      }

      const fighterKey = fighterKeyFromId(fighterId);
      clearPipelineStateForFighter(fighterKey);

      try {
        await deleteObjectsByPrefix(fighterStoragePrefix(auth.userId, fighterId));
      } catch {
        // Best effort: storage cleanup should not block canonical fighter deletion.
      }

      const deleted = await deleteOwnedFighter(fighterId, auth.userId);
      if (!deleted) {
        return status(404, "Fighter not found.");
      }

      return status(204);
    },
    {
      params: fighterIdPathParamsSchema,
    },
  );
