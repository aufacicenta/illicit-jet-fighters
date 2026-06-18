import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

import { env } from "./config/env";

const sql = neon(env.DATABASE_URL);
const db = drizzle({ client: sql });

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied successfully!");
