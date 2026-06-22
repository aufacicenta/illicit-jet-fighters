import { useContext } from "react";

import { FighterBalanceContext } from "./FighterBalanceContext";

export const useFighterBalanceContext = () => {
  const context = useContext(FighterBalanceContext);

  if (context === undefined) {
    throw new Error(
      "useFighterBalanceContext must be used within a FighterBalanceContextController",
    );
  }

  return context;
};
