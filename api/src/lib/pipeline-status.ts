import type { FighterSectionId, SectionOutput } from "./types";

export type SectionStatus = "locked" | "ready" | "generating" | "complete" | "error";

const sectionOrder: FighterSectionId[] = [
  "character-description",
  "specsheet-prompt",
  "specsheet-image",
  "spritesheet-prompt",
  "spritesheet-image",
  "spritesheet-manifest",
  "agent-code",
  "strikecraft-specsheet-prompt",
  "strikecraft-specsheet-image",
  "strikecraft-sprite-prompt",
  "strikecraft-sprite-image",
];

export type PipelineSnapshot = {
  outputs: Partial<Record<FighterSectionId, SectionOutput>>;
  activeSectionIds: FighterSectionId[];
  lastErrorSectionId: FighterSectionId | null;
};

export const deriveSectionStatuses = ({
  outputs,
  activeSectionIds,
  lastErrorSectionId,
}: PipelineSnapshot): Record<FighterSectionId, SectionStatus> => {
  const statuses: Record<FighterSectionId, SectionStatus> = {
    "character-description": "ready",
    "specsheet-prompt": "locked",
    "specsheet-image": "locked",
    "spritesheet-prompt": "locked",
    "spritesheet-image": "locked",
    "spritesheet-manifest": "locked",
    "agent-code": "locked",
    "strikecraft-specsheet-prompt": "locked",
    "strikecraft-specsheet-image": "locked",
    "strikecraft-sprite-prompt": "locked",
    "strikecraft-sprite-image": "locked",
  };

  for (const sectionId of sectionOrder) {
    if (outputs[sectionId]) {
      statuses[sectionId] = "complete";
    }
  }

  for (let index = 0; index < sectionOrder.length - 1; index += 1) {
    const current = sectionOrder[index]!;
    const next = sectionOrder[index + 1]!;
    if (statuses[current] === "complete" && statuses[next] === "locked") {
      statuses[next] = "ready";
    }
  }

  for (const activeSectionId of activeSectionIds) {
    statuses[activeSectionId] = "generating";
  }

  if (lastErrorSectionId) {
    statuses[lastErrorSectionId] = "error";
  }

  return statuses;
};
