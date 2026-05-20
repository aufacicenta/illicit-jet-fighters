import { apiRoutes } from "../../hooks/useRoutes";
import { post } from "./client";
import { type ChatMessage } from "./types";

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
