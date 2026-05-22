import { Elysia } from "elysia";

import { getOwnedFighter, parseFighterIdParam } from "../../lib/fighter-access";
import { buildFighterCostSnapshot } from "../../lib/llm-usage-repository";
import { requireBearerAuth } from "../../lib/require-bearer-auth";

export const costRoutes = new Elysia({ prefix: "/costs" }).get(
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
);
