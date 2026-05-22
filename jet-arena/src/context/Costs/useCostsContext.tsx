import { useContext } from "react";

import { CostsContext } from "./CostsContext";

export const useCostsContext = () => {
  const context = useContext(CostsContext);

  if (context === undefined) {
    throw new Error("useCostsContext must be used within a CostsContextController");
  }

  return context;
};
