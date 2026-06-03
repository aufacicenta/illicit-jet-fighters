import { createContext } from "react";

import type { ArenaPoolsContextType } from "./ArenaPoolsContext.types";

export const ArenaPoolsContext = createContext<ArenaPoolsContextType | undefined>(undefined);
