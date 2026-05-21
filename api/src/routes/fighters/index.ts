import type { FighterAgentVersionsResponse, MyFightersResponse } from "@ijf/shared";
import { Elysia } from "elysia";

import { listFighterAgentVersionsForOwnerAndFighter } from "../../lib/agent-version-repository";
import {
  createFighterForUser,
  ensureFighterForUser,
  fighterKeyFromId,
  getOwnedFighter,
  listOwnedFighters,
  parseFighterIdParam,
} from "../../lib/fighter-access";
import {
  bindPipelineTenant,
  buildFighterPreviewFromSnapshot,
  serializeClientPipelineState,
} from "../../lib/pipeline-runner";
import { requireBearerAuth } from "../../lib/require-bearer-auth";

export const fighterSessionRoutes = new Elysia({ prefix: "/fighters" })
  .post("", async ({ request, headers }) => {
    const auth = await requireBearerAuth(request, headers);
    const id = await createFighterForUser(auth.userId);
    return { id };
  })
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
  })
  .get("/:id/agent-versions", async ({ params, request, headers, status }) => {
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

    return {
      versions: versions.map((version) => ({
        id: version.id,
        fighterId: version.fighterId,
        versionNumber: version.versionNumber,
        model: version.model,
        createdAt: version.createdAt.toISOString(),
      })),
    } satisfies FighterAgentVersionsResponse;
  });
