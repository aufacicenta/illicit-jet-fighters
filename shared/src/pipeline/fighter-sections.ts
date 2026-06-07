import { apiSectionIdSchema, type ApiSectionId } from "../schemas/api/sections";

export const FIGHTER_PIPELINE_SECTION_ORDER = apiSectionIdSchema.options;

export const FIGHTER_PHASE_ONE_SECTION_IDS = FIGHTER_PIPELINE_SECTION_ORDER.slice(0, 5);

export const FIGHTER_PHASE_TWO_SECTION_IDS = FIGHTER_PIPELINE_SECTION_ORDER.filter(
  (sectionId) =>
    sectionId !== "spritesheet-manifest" && !FIGHTER_PHASE_ONE_SECTION_IDS.includes(sectionId),
);

export const FIGHTER_INTAKE_REQUIRED_SECTION_IDS = FIGHTER_PIPELINE_SECTION_ORDER.filter(
  (sectionId) => sectionId !== "spritesheet-manifest",
);

export type FighterPipelineSectionStatus =
  | "locked"
  | "ready"
  | "generating"
  | "complete"
  | "error"
  | "blocked";

export const isFighterPipelineFullyComplete = (
  sectionStatuses:
    | Partial<Record<ApiSectionId, FighterPipelineSectionStatus>>
    | Record<string, string>,
) =>
  FIGHTER_INTAKE_REQUIRED_SECTION_IDS.every(
    (sectionId) => sectionStatuses[sectionId] === "complete",
  );

export const countCompletedFighterIntakeSections = (
  sectionStatuses:
    | Partial<Record<ApiSectionId, FighterPipelineSectionStatus>>
    | Record<string, string>,
) =>
  FIGHTER_INTAKE_REQUIRED_SECTION_IDS.filter(
    (sectionId) => sectionStatuses[sectionId] === "complete",
  ).length;
