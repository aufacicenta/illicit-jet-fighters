import { Elysia } from "elysia";

import { createBattlefieldForUser, ensureBattlefieldForUser } from "../../lib/battlefield-access";
import { requireBearerAuth } from "../../lib/require-bearer-auth";

export const battlefieldSessionRoutes = new Elysia({ prefix: "/battlefields" })
  .post("", async ({ request, headers }) => {
    const auth = await requireBearerAuth(request, headers);
    const id = await createBattlefieldForUser(auth.userId);
    return { id };
  })
  .post("/session", async ({ request, headers }) => {
    const auth = await requireBearerAuth(request, headers);
    const id = await ensureBattlefieldForUser(auth.userId);
    return { id };
  });
