import path from "node:path";

import { loadEnvFiles, walletEnvSchema } from "@ijf/shared/config";
import { z } from "zod";

const databaseDir = path.resolve(import.meta.dir, "..", "..");
const workspaceDir = path.resolve(databaseDir, "..");

loadEnvFiles([
  path.join(workspaceDir, ".env.local"),
  path.join(workspaceDir, ".env"),
  path.join(databaseDir, ".env.local"),
  path.join(databaseDir, ".env"),
]);

const dbEnvSchema = walletEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
});

const parsed = dbEnvSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid database environment configuration: ${details}`);
}

export const env = parsed.data;
