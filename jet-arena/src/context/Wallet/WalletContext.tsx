import { createContext } from "react";

import type { WalletContextType } from "./WalletContext.types";

export const WalletContext = createContext<WalletContextType | undefined>(undefined);
