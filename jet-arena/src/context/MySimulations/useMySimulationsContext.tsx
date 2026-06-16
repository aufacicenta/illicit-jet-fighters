import { useContext } from "react";

import { MySimulationsContext } from "./MySimulationsContext";

export const useMySimulationsContext = () => {
  const context = useContext(MySimulationsContext);

  if (context === undefined) {
    throw new Error("useMySimulationsContext must be used within a MySimulationsContextController");
  }

  return context;
};
