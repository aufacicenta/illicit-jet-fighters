import { Elysia } from "elysia";

import { generateSpecsheetPrompt, generateSpecsheetPromptRefine } from "../../../lib/generate";
import type {
  SpecsheetPromptRefineRequest,
  SpecsheetPromptRequest,
  SpecsheetPromptResponse,
} from "./types";

export const specsheetPromptRoute = new Elysia()
  .post("/specsheet-prompt", async ({ body }) => {
    const { characterDescription } = body as SpecsheetPromptRequest;
    const generated = await generateSpecsheetPrompt(characterDescription);
    return generated satisfies SpecsheetPromptResponse;
  })
  .post("/specsheet-prompt/refine", async ({ body }) => {
    const { message, history } = body as SpecsheetPromptRefineRequest;
    return generateSpecsheetPromptRefine(history, message);
  });
