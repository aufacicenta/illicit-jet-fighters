import {
  battlefieldIdPathParamsSchema,
  battlefieldIdResponseSchema,
  myBattlefieldsResponseSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import {
  battlefieldKeyFromId,
  createBattlefieldForUser,
  deleteOwnedBattlefield,
  ensureBattlefieldForUser,
  getOwnedBattlefield,
  listOwnedBattlefields,
  parseBattlefieldIdParam,
} from "../../lib/battlefield-access";
import { clearPipelineStateForBattlefield } from "../../lib/battlefield-pipeline-runner";
import { deleteObjectsByPrefix } from "../../lib/r2";
import { requireBearerAuth } from "../../lib/require-bearer-auth";

const battlefieldStoragePrefix = (userId: string, battlefieldId: number) =>
  `users/${userId}/battlefields/${String(battlefieldId)}/`;

export const battlefieldSessionRoutes = new Elysia({ prefix: "/battlefields" })
  .get(
    "",
    async ({ request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const battlefields = await listOwnedBattlefields(auth.userId);
      return {
        battlefields: battlefields.map((battlefield) => ({
          ...battlefield,
          createdAt: battlefield.createdAt.toISOString(),
          updatedAt: battlefield.updatedAt.toISOString(),
        })),
      };
    },
    {
      response: {
        200: myBattlefieldsResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .post(
    "",
    async ({ request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const id = await createBattlefieldForUser(auth.userId);
      return { id };
    },
    {
      response: {
        200: battlefieldIdResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .post(
    "/session",
    async ({ request, headers }) => {
      const auth = await requireBearerAuth(request, headers);
      const id = await ensureBattlefieldForUser(auth.userId);
      return { id };
    },
    {
      response: {
        200: battlefieldIdResponseSchema,
        401: t.String(),
        403: t.String(),
      },
    },
  )
  .delete(
    "/:id",
    async ({ params, request, headers, status }) => {
      const auth = await requireBearerAuth(request, headers);
      const battlefieldId = parseBattlefieldIdParam(params.id);
      if (!battlefieldId) {
        return status(400, "Invalid battlefield id.");
      }

      const ownedBattlefield = await getOwnedBattlefield(battlefieldId, auth.userId);
      if (!ownedBattlefield) {
        return status(404, "Battlefield not found.");
      }

      const battlefieldKey = battlefieldKeyFromId(battlefieldId);
      clearPipelineStateForBattlefield(battlefieldKey);

      try {
        await deleteObjectsByPrefix(battlefieldStoragePrefix(auth.userId, battlefieldId));
      } catch {
        // Best effort: storage cleanup should not block canonical battlefield deletion.
      }

      const deleted = await deleteOwnedBattlefield(battlefieldId, auth.userId);
      if (!deleted) {
        return status(404, "Battlefield not found.");
      }

      return status(204);
    },
    {
      params: battlefieldIdPathParamsSchema,
    },
  );
