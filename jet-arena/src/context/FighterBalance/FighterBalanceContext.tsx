import { createContext } from "react";

import type { FighterBalanceContextType } from "./FighterBalanceContext.types";

export const FighterBalanceContext = createContext<FighterBalanceContextType | undefined>(
  undefined,
);
