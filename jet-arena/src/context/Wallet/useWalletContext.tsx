import { useContext } from "react";

import { WalletContext } from "./WalletContext";

export const useWalletContext = () => {
  const context = useContext(WalletContext);

  if (context === undefined) {
    throw new Error("useWalletContext must be used within a WalletContextController");
  }

  return context;
};
