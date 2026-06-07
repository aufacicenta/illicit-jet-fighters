import {
  countCompletedFighterIntakeSections,
  FIGHTER_INTAKE_REQUIRED_SECTION_IDS,
  FIGHTER_PHASE_ONE_SECTION_IDS,
  FIGHTER_PHASE_TWO_SECTION_IDS,
  isFighterPipelineFullyComplete,
} from "@ijf/shared";

import type { SectionId, SectionStatus } from "../context/Wizard/WizardContext.types";

export type FighterSectionDef = { id: SectionId; label: string };

export const PHASE_ONE_SECTIONS: FighterSectionDef[] = [
  { id: "character-description", label: "briefing" },
  { id: "character-pfp-prompt", label: "pfp brief" },
  { id: "character-pfp-image", label: "pfp render" },
  { id: "specsheet-prompt", label: "targeting" },
  { id: "specsheet-image", label: "render" },
];

export const PHASE_TWO_SECTIONS: FighterSectionDef[] = [
  { id: "spritesheet-prompt", label: "sprite brief" },
  { id: "spritesheet-image", label: "sprite render" },
  { id: "agent-code", label: "agent code" },
  { id: "strikecraft-specsheet-prompt", label: "craft brief" },
  { id: "strikecraft-specsheet-image", label: "craft render" },
  { id: "strikecraft-sprite-prompt", label: "craft top brief" },
  { id: "strikecraft-sprite-image", label: "craft top render" },
];

export const PHASE_ONE_SECTION_IDS: SectionId[] = FIGHTER_PHASE_ONE_SECTION_IDS;
export const PHASE_TWO_SECTION_IDS: SectionId[] = FIGHTER_PHASE_TWO_SECTION_IDS;

export const ALL_REQUIRED_SECTION_IDS: SectionId[] = FIGHTER_INTAKE_REQUIRED_SECTION_IDS;

export const isPhaseComplete = (
  phaseSectionIds: SectionId[],
  sectionStatuses: Partial<Record<SectionId, SectionStatus>> | Record<string, string>,
) => phaseSectionIds.every((id) => sectionStatuses[id] === "complete");

export const isFighterFullyComplete = isFighterPipelineFullyComplete;

export const countCompletedRequiredSections = countCompletedFighterIntakeSections;

export type FighterIneligibilityReason =
  | { kind: "wizard-incomplete"; status: string }
  | { kind: "sections-incomplete"; completedCount: number; totalCount: number }
  | { kind: "no-pipeline" };

export const getFighterIneligibilityLabel = (reason: FighterIneligibilityReason): string => {
  switch (reason.kind) {
    case "wizard-incomplete":
      if (reason.status === "generating") {
        return "Wizard still generating";
      }
      if (reason.status === "error") {
        return "Wizard has errors";
      }
      if (reason.status === "locked") {
        return "Wizard not started";
      }
      return "Wizard incomplete";
    case "sections-incomplete":
      return `Wizard incomplete (${reason.completedCount}/${reason.totalCount} sections)`;
    case "no-pipeline":
      return "No pipeline data";
  }
};
