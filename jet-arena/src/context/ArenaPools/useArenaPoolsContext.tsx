import { useContext } from "react";

import { ArenaPoolsContext } from "./ArenaPoolsContext";

export const useArenaPoolsContext = () => {
  const context = useContext(ArenaPoolsContext);

  if (context === undefined) {
    throw new Error("useArenaPoolsContext must be used within an ArenaPoolsContextController");
  }

  return context;
};
