import { createContext } from "react";

import type { CockpitStatsContextType } from "./CockpitStatsContext.types";

export const CockpitStatsContext = createContext<CockpitStatsContextType | undefined>(undefined);
