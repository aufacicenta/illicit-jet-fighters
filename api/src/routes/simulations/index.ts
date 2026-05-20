import { simulationManager } from "@ijf/simulator";
import { Elysia, t } from "elysia";

import { fighterKeyFromId, getOwnedFighter, parseFighterIdParam } from "../../lib/fighter-access";
import { bindPipelineTenant, serializeClientPipelineState } from "../../lib/pipeline-runner";
import { requireBearerAuth } from "../../lib/require-bearer-auth";

const resolveOwnedFighter = async (
  request: Request,
  headers: Record<string, string | undefined>,
  rawId: string,
) => {
  const auth = await requireBearerAuth(request, headers);
  const fighterId = parseFighterIdParam(rawId);
  if (!fighterId) {
    return { error: "Invalid fighter id." as const };
  }

  const owned = await getOwnedFighter(fighterId, auth.userId);
  if (!owned) {
    return { error: "Fighter not found." as const };
  }

  const fighterKey = fighterKeyFromId(fighterId);
  bindPipelineTenant(fighterKey, { userId: auth.userId, fighterId });
  return { fighterId, fighterKey };
};

const buildPlayersForFighter = async (fighterKey: string) => {
  const snapshot = await serializeClientPipelineState(fighterKey);
  const maybeAgentCode = snapshot?.outputs?.["agent-code"]?.content;
  if (!maybeAgentCode || maybeAgentCode.trim().length === 0) {
    return [];
  }

  return [
    {
      id: `jet-fighter-${fighterKey}`,
      code: maybeAgentCode,
    },
  ];
};

export const simulationRoutes = new Elysia({ prefix: "/simulations" })
  .post(
    "",
    async ({ body, request, headers, status }) => {
      const resolution = await resolveOwnedFighter(request, headers, String(body.fighterId));
      if ("error" in resolution) {
        return status(404, resolution.error);
      }

      const players = await buildPlayersForFighter(resolution.fighterKey);
      const broadcastId = `${resolution.fighterId}-${crypto.randomUUID()}`;
      const summary = simulationManager.startSimulation({
        broadcastId,
        players,
        seed: body.seed ?? Date.now(),
      });

      return {
        broadcastId: summary.broadcastId,
        status: summary.status,
      };
    },
    {
      body: t.Object({
        fighterId: t.Number(),
        seed: t.Optional(t.Number()),
      }),
    },
  )
  .get("/:id/status", async ({ params, status }) => {
    const summary = simulationManager.getSummary(params.id);
    if (!summary) {
      return status(404, "Simulation not found.");
    }
    return summary;
  })
  .get("/:id/replay", async ({ params, status }) => {
    const frames = simulationManager.getReplay(params.id);
    if (!frames) {
      return status(404, "Simulation not found.");
    }
    return { frames };
  });
