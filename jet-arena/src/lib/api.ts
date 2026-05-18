import { apiRoutes } from "../hooks/useRoutes";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const post = async <TResponse>(url: string, body: Record<string, unknown>): Promise<TResponse> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Request failed.");
  }

  return (await response.json()) as TResponse;
};

export const startPipeline = (fighterId: string, prompt: string) =>
  post<{ status: "started" }>(apiRoutes.pipelineStart, { fighterId, prompt });

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
