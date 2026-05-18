import type { ChatMessage } from "../../../lib/types";

export type CharacterDescriptionRequest = {
  prompt: string;
};

export type CharacterDescriptionResponse = {
  markdown: string;
  model: string;
};

export type CharacterDescriptionRefineRequest = {
  message: string;
  history: ChatMessage[];
};
