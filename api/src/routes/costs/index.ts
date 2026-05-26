import {
  battlefieldCostSnapshotSchema,
  battlefieldIdPathParamsSchema,
  fighterCostSnapshotSchema,
  fighterIdPathParamsSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import { getOwnedBattlefield, parseBattlefieldIdParam } from "../../lib/battlefield-access";
import { getOwnedFighter, parseFighterIdParam } from "../../lib/fighter-access";
import {
  buildBattlefieldCostSnapshot,
  buildFighterCostSnapshot,
} from "../../lib/llm-usage-repository";
import { requireBearerAuth } from "../../lib/require-bearer-auth";

export const costRoutes = new Elysia({ prefix: "/costs" })
  .get(
    "/fighter/:id",
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

      return buildFighterCostSnapshot({
        userId: auth.userId,
        fighterId,
      });
    },
    {
      params: fighterIdPathParamsSchema,
      response: {
        200: fighterCostSnapshotSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  )
  .get(
    "/battlefield/:id",
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

      return buildBattlefieldCostSnapshot({
        userId: auth.userId,
        battlefieldId,
      });
    },
    {
      params: battlefieldIdPathParamsSchema,
      response: {
        200: battlefieldCostSnapshotSchema,
        400: t.String(),
        401: t.String(),
        403: t.String(),
        404: t.String(),
      },
    },
  );
