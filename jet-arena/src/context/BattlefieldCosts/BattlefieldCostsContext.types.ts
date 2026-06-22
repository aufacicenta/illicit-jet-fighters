import type { BattlefieldCostSnapshot as SharedBattlefieldCostSnapshot } from "@ijf/shared";
import type { ReactNode } from "react";

import type { BattlefieldSectionId } from "../BattlefieldWizard/BattlefieldWizardContext.types";

export type BattlefieldCostSnapshot = SharedBattlefieldCostSnapshot & {
  latestRunSectionCosts: Partial<Record<BattlefieldSectionId, string>>;
};

export type BattlefieldCostsContextControllerProps = {
  battlefieldId: string;
  children: ReactNode;
};

export type BattlefieldCostsContextType = {
  battlefieldId: string;
  isLoading: boolean;
  errorMessage: string | null;
  totalCostUsd: string;
  latestRunCorrelationId: string | null;
  latestRunSectionCosts: Partial<Record<BattlefieldSectionId, string>>;
  getSectionLatestRunCostUsd: (sectionId: BattlefieldSectionId) => string;
  formatUsd: (value: string | number | null | undefined) => string;
  refresh: () => Promise<void>;
};

export const getBattlefieldWizardCostUpdateEventName = (battlefieldId: string) =>
  `battlefield-wizard:cost-update:${battlefieldId}`;
