import { readFileSync } from "node:fs";
import { join } from "node:path";

const skillsDir = join(import.meta.dir, "..", "skills");

const characterDescription = readFileSync(join(skillsDir, "character-description.md"), "utf8");

const rawSpecsheet = readFileSync(join(skillsDir, "character-specsheet-generator.md"), "utf8");
const rawCharacterPfp = readFileSync(join(skillsDir, "character-pfp-generator.md"), "utf8");
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
const battlefieldDescription = readFileSync(join(skillsDir, "battlefield-description.md"), "utf8");
const rawBattlefieldSheetPrompt = readFileSync(
  join(skillsDir, "battlefield-sheet-generator.md"),
  "utf8",
);
const battlefieldConfig = readFileSync(join(skillsDir, "battlefield-config-generator.md"), "utf8");

const globalStylePrefix = readFileSync(
  join(skillsDir, "agent-character-sheet-global-style.md"),
  "utf8",
).trim();

const specsheetPrompt = rawSpecsheet.replace(/\[GLOBAL PREFIX\]/g, globalStylePrefix);
const portraitGlobalStylePrefix = globalStylePrefix
  .replaceAll("character design reference sheet", "character portrait")
  .replaceAll("retro game sprite sheet layout", "single square portrait frame")
  .replaceAll("on light grey background", "square 1:1 aspect ratio")
  .replaceAll("landscape orientation", "square 1:1 aspect ratio")
  .replaceAll(
    "organized grid layout with labeled sections in small pixel font",
    "head-and-shoulders composition cropped at mid-chest",
  )
  .replaceAll(
    "game development character sheet with front / side / back orthographic sprite views",
    "Metal Gear codec call framing",
  )
  .replaceAll("visible pixel grid structure", "selective outline (selout) technique")
  .replaceAll("SNK Neo Geo portrait art", "SNK Neo Geo character select portraits");
const characterPfpPrompt = rawCharacterPfp.replace(/\[GLOBAL PREFIX\]/g, portraitGlobalStylePrefix);
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
const battlefieldGlobalStylePrefix = globalStylePrefix
  .replaceAll("character design reference sheet", "battlefield environment reference sheet")
  .replaceAll("character", "battlefield")
  .replaceAll("portrait", "panoramic vista")
  .replaceAll("pilot design", "arena design")
  .replaceAll("sprite sheet", "environment sheet")
  .replaceAll("codec portrait aesthetic", "mission dossier landscape aesthetic");
const battlefieldSheetPrompt = rawBattlefieldSheetPrompt.replace(
  /\[GLOBAL PREFIX\]/g,
  battlefieldGlobalStylePrefix,
);

export const skills = {
  characterDescription,
  characterPfpPrompt,
  specsheetPrompt,
  spritesheetPrompt,
  spritesheetManifestMapper,
  agentCode,
  strikecraftSpecsheetPrompt,
  strikecraftSpritePrompt,
  battlefieldDescription,
  battlefieldSheetPrompt,
  battlefieldConfig,
} as const;
