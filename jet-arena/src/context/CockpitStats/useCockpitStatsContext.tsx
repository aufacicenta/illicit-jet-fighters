import { useContext } from "react";

import { CockpitStatsContext } from "./CockpitStatsContext";

export const useCockpitStatsContext = () => {
  const context = useContext(CockpitStatsContext);

  if (context === undefined) {
    throw new Error("useCockpitStatsContext must be used within a CockpitStatsContextController");
  }

  return context;
};
