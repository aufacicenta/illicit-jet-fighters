import { useContext } from "react";

import { MyBattlefieldsContext } from "./MyBattlefieldsContext";

export const useMyBattlefieldsContext = () => {
  const context = useContext(MyBattlefieldsContext);

  if (context === undefined) {
    throw new Error(
      "useMyBattlefieldsContext must be used within a MyBattlefieldsContextController",
    );
  }

  return context;
};
