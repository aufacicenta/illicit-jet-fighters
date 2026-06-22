import { createContext } from "react";

import type { MySimulationsContextType } from "./MySimulationsContext.types";

export const MySimulationsContext = createContext<MySimulationsContextType | undefined>(undefined);
