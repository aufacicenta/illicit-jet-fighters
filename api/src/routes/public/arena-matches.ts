import {
  publicArenaMatchesQuerySchema,
  type PublicArenaMatchesResponse,
  publicArenaMatchesResponseSchema,
} from "@ijf/shared";
import { Elysia } from "elysia";

import { listRecentPublicArenaMatches } from "../../lib/public-arena-matches";

const DEFAULT_LIMIT = 50;
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

export const publicArenaMatchesRoutes = new Elysia({ prefix: "/public/arena" }).get(
  "/matches",
  async ({ query }) => {
    const limit = parseLimit(query.limit);
    const matches = await listRecentPublicArenaMatches({ limit });

    return {
      matches,
    } satisfies PublicArenaMatchesResponse;
  },
  {
    query: publicArenaMatchesQuerySchema,
    response: {
      200: publicArenaMatchesResponseSchema,
    },
  },
);
