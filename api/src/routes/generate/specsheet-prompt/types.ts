import type { ChatMessage } from "../../../lib/types";

export type SpecsheetPromptRequest = {
  characterDescription: string;
};

export type SpecsheetPromptResponse = {
  prompt: string;
  model: string;
};

export type SpecsheetPromptRefineRequest = {
  message: string;
  history: ChatMessage[];
};
