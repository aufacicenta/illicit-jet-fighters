import { Elysia } from "elysia";

import { characterDescriptionRoute } from "./character-description";
import { specsheetImageRoute } from "./specsheet-image";
import { specsheetPromptRoute } from "./specsheet-prompt";

export const generateRoutes = new Elysia({ prefix: "/generate" })
  .use(characterDescriptionRoute)
  .use(specsheetPromptRoute)
  .use(specsheetImageRoute);
