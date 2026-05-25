import { Elysia } from "elysia";

import {
  createBattlefieldForUser,
  ensureBattlefieldForUser,
  listOwnedBattlefields,
} from "../../lib/battlefield-access";
import { requireBearerAuth } from "../../lib/require-bearer-auth";

export const battlefieldSessionRoutes = new Elysia({ prefix: "/battlefields" })
  .get("", async ({ request, headers }) => {
    const auth = await requireBearerAuth(request, headers);
    const battlefields = await listOwnedBattlefields(auth.userId);
    return {
      battlefields: battlefields.map((battlefield) => ({
        ...battlefield,
        createdAt: battlefield.createdAt.toISOString(),
        updatedAt: battlefield.updatedAt.toISOString(),
      })),
    };
  })
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
