import type { PublicFighterDetail, PublicFightersResponse } from "@ijf/shared";
import {
  fighterIdPathParamsSchema,
  publicFighterDetailSchema,
  publicFightersQuerySchema,
  publicFightersResponseSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import { parseFighterIdParam } from "../../lib/fighter-access";
import { buildPublicFighterDetail, listPublicFighters } from "../../lib/public-fighters";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

const parseLimit = (value: string | undefined): number => {
  if (!value) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
};

const parseOffset = (value: string | undefined): number => {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
};

export const publicFighterRoutes = new Elysia({ prefix: "/public/fighters" })
  .get(
    "",
    async ({ query }) => {
      const sort = query.sort === "wins" ? "wins" : "latest";
      const limit = parseLimit(query.limit);
      const offset = parseOffset(query.offset);
      const fighters = await listPublicFighters({ sort, limit, offset });

      return {
        fighters,
      } satisfies PublicFightersResponse;
    },
    {
      query: publicFightersQuerySchema,
      response: {
        200: publicFightersResponseSchema,
      },
    },
  )
  .get(
    "/:id",
    async ({ params, status }) => {
      const fighterId = parseFighterIdParam(params.id);
      if (!fighterId) {
        return status(400, "Invalid fighter id.");
      }

      const fighter = await buildPublicFighterDetail(fighterId);
      if (!fighter) {
        return status(404, "Fighter not found.");
      }

      return fighter satisfies PublicFighterDetail;
    },
    {
      params: fighterIdPathParamsSchema,
      response: {
        200: publicFighterDetailSchema,
        400: t.String(),
        404: t.String(),
      },
    },
  );
