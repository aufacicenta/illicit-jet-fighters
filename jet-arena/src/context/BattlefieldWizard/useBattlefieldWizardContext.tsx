import { useContext } from "react";

import { BattlefieldWizardContext } from "./BattlefieldWizardContext";

export const useBattlefieldWizardContext = () => {
  const context = useContext(BattlefieldWizardContext);

  if (context === undefined) {
    throw new Error(
      "useBattlefieldWizardContext must be used within a BattlefieldWizardContextController",
    );
  }

  return context;
};
