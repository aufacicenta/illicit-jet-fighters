import { pipelineStartSchema } from "@ijf/shared";

import { apiRoutes } from "../../hooks/useRoutes";
import { authHeadersJson, post, readErrorText } from "./client";
import { type PipelineStateSnapshot } from "./types";

export const fetchPipelineState = async (
  fighterId: string,
): Promise<PipelineStateSnapshot | null> => {
  const response = await fetch(apiRoutes.pipelineState(fighterId), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...authHeadersJson(),
    },
  });

  if (response.status === 404 || response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  return (await response.json()) as PipelineStateSnapshot;
};

export const startPipeline = (fighterId: number, prompt: string) => {
  const payload = pipelineStartSchema.parse({ id: fighterId, prompt });
  return post<{ status: "started" }>(apiRoutes.pipelineStart, payload);
};

export const generatePipelineSpecsheet = (fighterId: number, characterDescription: string) =>
  post<{ status: "started" }>(apiRoutes.pipelineSpecsheet, {
    id: fighterId,
    characterDescription,
  });

export const generatePipelineAgentCode = (fighterId: number) =>
  post<{ status: "started" }>(apiRoutes.pipelineAgentCode, {
    id: fighterId,
  });

export const generatePipelineSpritesheetImage = (fighterId: number) =>
  post<{ status: "started" }>(apiRoutes.pipelineSpritesheetImage, {
    id: fighterId,
  });

export const generatePipelineStrikecraftSpriteImage = (fighterId: number) =>
  post<{ status: "started" }>(apiRoutes.pipelineStrikecraftSpriteImage, {
    id: fighterId,
  });
