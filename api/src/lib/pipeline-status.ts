import type { SectionId, SectionOutput } from "./types";

export type SectionStatus = "locked" | "ready" | "generating" | "complete" | "error";

const sectionOrder: SectionId[] = [
  "character-description",
  "specsheet-prompt",
  "specsheet-image",
  "spritesheet-prompt",
  "spritesheet-image",
  "agent-code",
  "strikecraft-specsheet-prompt",
  "strikecraft-specsheet-image",
  "strikecraft-sprite-prompt",
  "strikecraft-sprite-image",
];

export type PipelineSnapshot = {
  outputs: Partial<Record<SectionId, SectionOutput>>;
  activeSectionId: SectionId | null;
  lastErrorSectionId: SectionId | null;
};

export const deriveSectionStatuses = ({
  outputs,
  activeSectionId,
  lastErrorSectionId,
}: PipelineSnapshot): Record<SectionId, SectionStatus> => {
  const statuses: Record<SectionId, SectionStatus> = {
    "character-description": "ready",
    "specsheet-prompt": "locked",
    "specsheet-image": "locked",
    "spritesheet-prompt": "locked",
    "spritesheet-image": "locked",
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

  if (activeSectionId) {
    statuses[activeSectionId] = "generating";
  }

  if (lastErrorSectionId) {
    statuses[lastErrorSectionId] = "error";
  }

  return statuses;
};
