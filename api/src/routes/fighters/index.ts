import { Elysia } from "elysia";

import { ensureFighterForUser } from "../../lib/fighter-access";
import { requireBearerAuth } from "../../lib/require-bearer-auth";

export const fighterSessionRoutes = new Elysia({ prefix: "/fighters" }).post(
  "/session",
  async ({ request, headers }) => {
    const auth = await requireBearerAuth(request, headers);
    const id = await ensureFighterForUser(auth.userId);
    return { id };
  },
);
