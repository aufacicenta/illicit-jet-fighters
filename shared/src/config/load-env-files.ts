import fs from "node:fs";
import path from "node:path";

import { parse as parseDotenv } from "dotenv";

const stripExportPrefixes = (raw: string) => raw.replace(/^\s*export\s+/gm, "");

const loadEnvFile = (filePath: string): void => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const parsed = parseDotenv(stripExportPrefixes(fs.readFileSync(filePath, "utf8")));
  if (!parsed || typeof parsed !== "object") {
    return;
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

export const loadEnvFiles = (paths: string[]): void => {
  for (const filePath of paths) {
    loadEnvFile(filePath);
  }
};

// `<shared>/src/config/load-env-files.ts` -> `<workspace>`
// shared is at <workspace>/shared, so go up three levels from this file.
const workspaceRoot = path.resolve(import.meta.dir, "..", "..", "..");

loadEnvFiles([path.join(workspaceRoot, ".env.local"), path.join(workspaceRoot, ".env")]);
