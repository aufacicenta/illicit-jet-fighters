import { createAuthClient } from "@neondatabase/neon-js/auth";

import { config } from "../config";

export type NeonAuthClient = ReturnType<typeof createAuthClient>;

export const authClient = createAuthClient(config.neonAuthUrl);
