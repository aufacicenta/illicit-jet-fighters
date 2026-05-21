import { readFileSync } from "node:fs";
import { join } from "node:path";

const skillsDir = join(import.meta.dir, "..", "skills");

const characterDescription = readFileSync(join(skillsDir, "character-description.md"), "utf8");

const rawSpecsheet = readFileSync(join(skillsDir, "character-specsheet-generator.md"), "utf8");
const spritesheetPrompt = readFileSync(
  join(skillsDir, "character-spritesheet-generator.md"),
  "utf8",
);
const spritesheetManifestMapper = readFileSync(
  join(skillsDir, "spritesheet-manifest-mapper.md"),
  "utf8",
);
const agentCode = readFileSync(join(skillsDir, "character-description-to-jet-agent.md"), "utf8");
const rawStrikecraftSpecsheetPrompt = readFileSync(
  join(skillsDir, "strikecraft-specsheet-generator.md"),
  "utf8",
);
const strikecraftSpritePrompt = readFileSync(
  join(skillsDir, "strikecraft-spritesheet-generator.md"),
  "utf8",
);

const globalStylePrefix = readFileSync(
  join(skillsDir, "agent-character-sheet-global-style.md"),
  "utf8",
).trim();

const specsheetPrompt = rawSpecsheet.replace(/\[GLOBAL PREFIX\]/g, globalStylePrefix);
const strikecraftGlobalStylePrefix = globalStylePrefix
  .replaceAll("character design reference sheet", "strikecraft reference sheet")
  .replaceAll("character", "strikecraft")
  .replaceAll("codec portrait aesthetic", "hangar dossier aesthetic")
  .replaceAll("pilot design", "strikecraft design")
  .replaceAll("briefing screen energy", "mission dossier energy");
const strikecraftSpecsheetPrompt = rawStrikecraftSpecsheetPrompt.replace(
  /\[GLOBAL PREFIX\]/g,
  strikecraftGlobalStylePrefix,
);

export const skills = {
  characterDescription,
  specsheetPrompt,
  spritesheetPrompt,
  spritesheetManifestMapper,
  agentCode,
  strikecraftSpecsheetPrompt,
  strikecraftSpritePrompt,
} as const;
