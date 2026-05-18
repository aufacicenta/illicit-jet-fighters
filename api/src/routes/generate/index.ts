import { Elysia } from "elysia";

import { characterDescriptionRoute } from "./character-description";
import { specsheetPromptRoute } from "./specsheet-prompt";
import { specsheetImageRoute } from "./specsheet-image";

export const generateRoutes = new Elysia({ prefix: "/generate" })
  .use(characterDescriptionRoute)
  .use(specsheetPromptRoute)
  .use(specsheetImageRoute);
