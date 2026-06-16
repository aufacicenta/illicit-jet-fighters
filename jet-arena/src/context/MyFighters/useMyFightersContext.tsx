import { useContext } from "react";

import { MyFightersContext } from "./MyFightersContext";

export const useMyFightersContext = () => {
  const context = useContext(MyFightersContext);

  if (context === undefined) {
    throw new Error("useMyFightersContext must be used within a MyFightersContextController");
  }

  return context;
};
