import { useContext } from "react";

import { CockpitAlertContext } from "./CockpitAlertContext";

export const useCockpitAlert = () => {
  const context = useContext(CockpitAlertContext);

  if (context === undefined) {
    throw new Error("useCockpitAlert must be used within a CockpitAlertContextController");
  }

  return context;
};
