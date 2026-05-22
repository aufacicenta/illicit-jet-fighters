import type { ReactNode } from "react";

import type { SectionId } from "../Wizard/WizardContext.types";

export type FighterCostSnapshot = {
  fighterId: number;
  totalCostUsd: string;
  latestRunCorrelationId: string | null;
  latestRunSectionCosts: Partial<Record<SectionId, string>>;
};

export type CostsContextControllerProps = {
  fighterId: string;
  children: ReactNode;
};

export type CostsContextType = {
  fighterId: string;
  isLoading: boolean;
  errorMessage: string | null;
  totalCostUsd: string;
  latestRunCorrelationId: string | null;
  latestRunSectionCosts: Partial<Record<SectionId, string>>;
  getSectionLatestRunCostUsd: (sectionId: SectionId) => string;
  formatUsd: (value: string | number | null | undefined) => string;
  refresh: () => Promise<void>;
};

export const getWizardCostUpdateEventName = (fighterId: string) =>
  `wizard:cost-update:${fighterId}`;
