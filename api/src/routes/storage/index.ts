import {
  fighterAgentPackageRequestSchema,
  fighterAgentPackageResponseSchema,
  fighterIdPathParamsSchema,
  fighterSpecsheetAssetResponseSchema,
} from "@ijf/shared";
import { Elysia, t } from "elysia";

import { archiveAgentSlugToZipBuffer } from "../../lib/agent-packager";
import { getOwnedFighter, parseFighterIdParam } from "../../lib/fighter-access";
import {
  agentZipObjectKey,
  getObjectBuffer,
  getSignedReadUrl,
  pipelineStateObjectKey,
  putObject,
} from "../../lib/r2";
import { requireBearerAuth } from "../../lib/require-bearer-auth";

type PersistedPipelineSnapshot = {
  outputs?: Partial<Record<"specsheet-image", { content?: string }>>;
};

export const assetRoutes = new Elysia({ prefix: "/assets" }).get(
  "/fighters/:id/specsheet-image",
  async ({ params, request, headers, status }) => {
    const auth = await requireBearerAuth(request, headers);
    const fighterId = parseFighterIdParam(params.id);
    if (!fighterId) {
      return status(400, "Invalid fighter id.");
    }

    const owned = await getOwnedFighter(fighterId, auth.userId);
    if (!owned) {
      return status(404, "Fighter not found.");
    }

    const buffer = await getObjectBuffer(pipelineStateObjectKey(auth.userId, fighterId));
    if (!buffer) {
      return status(404, "Pipeline state not found.");
    }

    let snapshot: PersistedPipelineSnapshot;
    try {
      snapshot = JSON.parse(buffer.toString()) as PersistedPipelineSnapshot;
    } catch {
      return status(404, "Pipeline snapshot is unreadable.");
    }

    const objectKey = snapshot.outputs?.["specsheet-image"]?.content;
    if (!objectKey?.startsWith("users/")) {
      return status(404, "Specsheet asset not published yet.");
    }

    const signedUrl = await getSignedReadUrl(objectKey);
    return { signedUrl };
  },
  {
    params: fighterIdPathParamsSchema,
    response: {
      200: fighterSpecsheetAssetResponseSchema,
      400: t.String(),
      401: t.String(),
      403: t.String(),
      404: t.String(),
    },
  },
);

export const agentRoutes = new Elysia({ prefix: "/agents" }).post(
  "/:id/package",
  async ({ params, body, request, headers, status }) => {
    const auth = await requireBearerAuth(request, headers);
    const fighterId = parseFighterIdParam(params.id);
    if (!fighterId) {
      return status(400, "Invalid fighter id.");
    }

    const owned = await getOwnedFighter(fighterId, auth.userId);
    if (!owned) {
      return status(404, "Fighter not found.");
    }

    const { agentSlug } = body;

    try {
      const archiveBuffer = await archiveAgentSlugToZipBuffer(agentSlug);
      const uploadKey = agentZipObjectKey(auth.userId, fighterId);
      await putObject(uploadKey, archiveBuffer, "application/zip");
      return { key: uploadKey };
    } catch (error) {
      return status(
        400,
        error instanceof Error ? error.message : "Unable to archive agent bundle.",
      );
    }
  },
  {
    params: fighterIdPathParamsSchema,
    body: fighterAgentPackageRequestSchema,
    response: {
      200: fighterAgentPackageResponseSchema,
      400: t.String(),
      401: t.String(),
      403: t.String(),
      404: t.String(),
    },
  },
);
