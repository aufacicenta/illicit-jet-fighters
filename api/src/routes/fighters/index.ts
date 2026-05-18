import type { MyFightersResponse } from "@ijf/shared";
import { Elysia } from "elysia";

import {
  ensureFighterForUser,
  fighterKeyFromId,
  listOwnedFighters,
} from "../../lib/fighter-access";
import {
  bindPipelineTenant,
  buildFighterPreviewFromSnapshot,
  serializeClientPipelineState,
} from "../../lib/pipeline-runner";
import { requireBearerAuth } from "../../lib/require-bearer-auth";

export const fighterSessionRoutes = new Elysia({ prefix: "/fighters" })
  .post("/session", async ({ request, headers }) => {
    const auth = await requireBearerAuth(request, headers);
    const id = await ensureFighterForUser(auth.userId);
    return { id };
  })
  .get("", async ({ request, headers }) => {
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
              status: "locked" as const,
            };

        return {
          id: fighter.id,
          slug: fighter.slug,
          briefing: fighter.briefing,
          createdAt: fighter.createdAt.toISOString(),
          updatedAt: fighter.updatedAt.toISOString(),
          characterDescription: preview.characterDescription,
          specsheetPrompt: preview.specsheetPrompt,
          specsheetImageUrl: preview.specsheetImageUrl,
          status: preview.status,
        };
      }),
    );

    return {
      fighters: hydrated,
    } satisfies MyFightersResponse;
  });
