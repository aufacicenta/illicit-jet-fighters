import { Elysia } from "elysia";

import {
  generateCharacterDescription,
  generateCharacterDescriptionRefine,
} from "../../../lib/generate";
import type {
  CharacterDescriptionRefineRequest,
  CharacterDescriptionRequest,
  CharacterDescriptionResponse,
} from "./types";

export const characterDescriptionRoute = new Elysia()
  .post("/character-description", async ({ body }) => {
    const { prompt } = body as CharacterDescriptionRequest;
    const generated = await generateCharacterDescription(prompt);
    return generated satisfies CharacterDescriptionResponse;
  })
  .post("/character-description/refine", async ({ body }) => {
    const { message, history } = body as CharacterDescriptionRefineRequest;
    return generateCharacterDescriptionRefine(history, message);
  });
