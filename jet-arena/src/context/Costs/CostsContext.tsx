import { createContext } from "react";

import type { CostsContextType } from "./CostsContext.types";

export const CostsContext = createContext<CostsContextType | undefined>(undefined);
