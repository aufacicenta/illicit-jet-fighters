import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { env } from "./config/env";
import * as schema from "./schema";

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle({
  client: pool,
  schema,
  ws: globalThis.WebSocket,
});

export type Database = typeof db;
