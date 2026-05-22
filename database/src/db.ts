import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize @ijf/database.");
}

const pool = new Pool({ connectionString: databaseUrl });

export const db = drizzle({
  client: pool,
  schema,
  ws: globalThis.WebSocket,
});

export type Database = typeof db;
