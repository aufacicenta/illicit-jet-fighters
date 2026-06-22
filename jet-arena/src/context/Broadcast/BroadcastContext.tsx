import { createContext } from "react";

import type { BroadcastContextType } from "./BroadcastContext.types";

export const BroadcastContext = createContext<BroadcastContextType | undefined>(undefined);
