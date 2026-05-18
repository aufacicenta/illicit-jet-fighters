import { OpenRouter } from "@openrouter/sdk";

import { env } from "../config/env";

export const openrouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});
