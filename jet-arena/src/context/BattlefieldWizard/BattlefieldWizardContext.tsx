import { createContext } from "react";

import type { BattlefieldWizardContextType } from "./BattlefieldWizardContext.types";

export const BattlefieldWizardContext = createContext<BattlefieldWizardContextType | undefined>(
  undefined,
);
