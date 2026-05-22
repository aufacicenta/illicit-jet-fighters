import fs from "node:fs";
import path from "node:path";

import { parse as parseDotenv } from "dotenv";

const stripExportPrefixes = (raw: string) => raw.replace(/^\s*export\s+/gm, "");

const loadEnvFile = (filePath: string): void => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const parsed = parseDotenv(stripExportPrefixes(fs.readFileSync(filePath, "utf8")));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const databaseDir = path.resolve(import.meta.dir, "..", "..");
const workspaceDir = path.resolve(databaseDir, "..");

for (const filePath of [
  path.join(databaseDir, ".env.local"),
  path.join(databaseDir, ".env"),
  path.join(workspaceDir, "api", ".env.local"),
  path.join(workspaceDir, "api", ".env"),
  path.join(workspaceDir, ".env.local"),
  path.join(workspaceDir, ".env"),
]) {
  loadEnvFile(filePath);
}
