import { createContext } from "react";

import type { WizardContextType } from "./WizardContext.types";

export const WizardContext = createContext<WizardContextType | undefined>(undefined);
