import { createContext } from "react";

import type { CockpitAlertContextType } from "./CockpitAlertContext.types";

export const CockpitAlertContext = createContext<CockpitAlertContextType | undefined>(undefined);
