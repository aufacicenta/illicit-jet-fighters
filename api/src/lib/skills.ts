import { readFileSync } from "node:fs";
import { join } from "node:path";

const skillsDir = join(import.meta.dir, "..", "skills");

const characterDescription = readFileSync(join(skillsDir, "character-description.md"), "utf8");

const rawSpecsheet = readFileSync(join(skillsDir, "character-specsheet-generator.md"), "utf8");

const globalStylePrefix = readFileSync(
  join(skillsDir, "agent-character-sheet-global-style.md"),
  "utf8",
).trim();

const specsheetPrompt = rawSpecsheet.replace(/\[GLOBAL PREFIX\]/g, globalStylePrefix);

export const skills = {
  characterDescription,
  specsheetPrompt,
} as const;
