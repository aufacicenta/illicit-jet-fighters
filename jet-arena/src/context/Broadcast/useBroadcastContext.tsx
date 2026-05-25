import { useContext } from "react";

import { BroadcastContext } from "./BroadcastContext";

export const useBroadcastContext = () => {
  const context = useContext(BroadcastContext);

  if (context === undefined) {
    throw new Error("useBroadcastContext must be used within a BroadcastContextController");
  }

  return context;
};
