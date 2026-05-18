import { pipelineStartSchema } from "@ijf/shared";

import { apiRoutes } from "../hooks/useRoutes";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ApiSectionId = "character-description" | "specsheet-prompt" | "specsheet-image";

export type ApiSectionStatus = "locked" | "ready" | "generating" | "complete" | "error";

export type ApiSectionOutput = {
  sectionId: ApiSectionId;
  content: string;
  generatedAt: string;
  model: string;
  mimeType?: string;
  assetUrl?: string;
};

export type PipelineStateSnapshot = {
  sectionStatuses: Record<ApiSectionId, ApiSectionStatus>;
  outputs: Partial<Record<ApiSectionId, ApiSectionOutput>>;
  histories: Partial<Record<ApiSectionId, ChatMessage[]>>;
  gateMessage: string | null;
};

let accessToken: string | undefined;

export const setApiAccessToken = (token: string | undefined) => {
  accessToken = token;
};

const authHeadersJson = (): HeadersInit => ({
  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
});

const readErrorText = async (response: Response) => (await response.text()) || response.statusText;

const post = async <TResponse>(url: string, body: Record<string, unknown>): Promise<TResponse> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeadersJson(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  return (await response.json()) as TResponse;
};

export const fighterSessionPost = async () => post<{ id: number }>(apiRoutes.fighterSession, {});

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

export const generateCharacterDescription = (prompt: string) =>
  post<{ markdown: string; model: string }>(apiRoutes.generateCharacterDescription, {
    prompt,
  });

export const refineCharacterDescription = (message: string, history: ChatMessage[]) =>
  post<{ markdown: string; model: string }>(apiRoutes.refineCharacterDescription, {
    message,
    history,
  });

export const generateSpecsheetPrompt = (characterDescription: string) =>
  post<{ prompt: string; model: string }>(apiRoutes.generateSpecsheetPrompt, {
    characterDescription,
  });

export const refineSpecsheetPrompt = (message: string, history: ChatMessage[]) =>
  post<{ prompt: string; model: string }>(apiRoutes.refineSpecsheetPrompt, {
    message,
    history,
  });

export const generateSpecsheetImage = (prompt: string) =>
  post<{ imageBase64: string; mimeType: string; model: string }>(apiRoutes.generateSpecsheetImage, {
    prompt,
  });
