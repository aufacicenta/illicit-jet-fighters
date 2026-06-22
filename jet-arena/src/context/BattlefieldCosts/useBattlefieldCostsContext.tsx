import { useContext } from "react";

import { BattlefieldCostsContext } from "./BattlefieldCostsContext";

export const useBattlefieldCostsContext = () => {
  const context = useContext(BattlefieldCostsContext);

  if (context === undefined) {
    throw new Error(
      "useBattlefieldCostsContext must be used within a BattlefieldCostsContextController",
    );
  }

  return context;
};
