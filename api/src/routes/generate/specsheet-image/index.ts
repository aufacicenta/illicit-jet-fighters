import { Elysia } from "elysia";

import { generateSpecsheetImage } from "../../../lib/generate";
import type { SpecsheetImageRequest, SpecsheetImageResponse } from "./types";

export const specsheetImageRoute = new Elysia()
  .post("/specsheet-image", async ({ body }) => {
    const { prompt } = body as SpecsheetImageRequest;
    const generated = await generateSpecsheetImage(prompt);
    return generated satisfies SpecsheetImageResponse;
  })
  .post("/specsheet-image/refine", async ({ body }) => {
    const { prompt } = body as SpecsheetImageRequest;
    return generateSpecsheetImage(prompt);
  });
