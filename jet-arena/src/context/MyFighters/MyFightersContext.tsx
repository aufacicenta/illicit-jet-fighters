import { createContext } from "react";

import type { MyFightersContextType } from "./MyFightersContext.types";

export const MyFightersContext = createContext<MyFightersContextType | undefined>(undefined);
