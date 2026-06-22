import type { ReplayFrame } from "@ijf/shared";
import type { ReactNode } from "react";

import type { SimulationListItem } from "../../lib/api/types";

type ArenaBounds = { width: number; height: number };

export type SimulationPreviewById = Record<
  string,
  {
    isLoading: boolean;
    error: string | null;
    frame: ReplayFrame | null;
    arenaBounds: ArenaBounds | null;
  }
>;

export type MySimulationsContextControllerProps = {
  children: ReactNode;
};

export type MySimulationsContextType = {
  simulations: SimulationListItem[];
  simulationPreviewById: SimulationPreviewById;
  isLoading: boolean;
  error: string | null;

  load: () => Promise<void>;
};
