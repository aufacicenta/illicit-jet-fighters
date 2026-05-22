import { useContext } from "react";

import { WalletContext } from "./WalletContext";

export const useOptionalWalletContext = () => useContext(WalletContext);
