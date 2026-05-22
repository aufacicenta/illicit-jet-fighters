import { createContext } from "react";

import type { BattlefieldCostsContextType } from "./BattlefieldCostsContext.types";

export const BattlefieldCostsContext = createContext<BattlefieldCostsContextType | undefined>(
  undefined,
);
