import { createContext } from "react";

import type { MyBattlefieldsContextType } from "./MyBattlefieldsContext.types";

export const MyBattlefieldsContext = createContext<MyBattlefieldsContextType | undefined>(
  undefined,
);
