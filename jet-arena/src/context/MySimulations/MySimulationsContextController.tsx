"use client";

import { useCallback, useState } from "react";

import { fetchMySimulations, fetchSimulationReplay } from "../../lib/api";
import type { SimulationListItem } from "../../lib/api/types";
import { MySimulationsContext } from "./MySimulationsContext";
import type {
  MySimulationsContextControllerProps,
  MySimulationsContextType,
  SimulationPreviewById,
} from "./MySimulationsContext.types";

export const MySimulationsContextController = ({
  children,
}: MySimulationsContextControllerProps) => {
  const [simulations, setSimulations] = useState<SimulationListItem[]>([]);
  const [simulationPreviewById, setSimulationPreviewById] = useState<SimulationPreviewById>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchMySimulations();
      setSimulations(response.simulations);

      const previewEntries = await Promise.all(
        response.simulations.map(async (simulation) => {
          if (simulation.replayFrameCount <= 0) {
            return [
              simulation.simulationId,
              {
                isLoading: false,
                error: null,
                frame: null,
                arenaBounds: null,
              },
            ] as const;
          }

          try {
            const replay = await fetchSimulationReplay(simulation.broadcastId);
            const frame = replay.frames.at(-1) ?? replay.frames[0] ?? null;
            const arenaBounds = replay.initData?.arenaBounds ?? null;
            return [
              simulation.simulationId,
              {
                isLoading: false,
                error: null,
                frame,
                arenaBounds,
              },
            ] as const;
          } catch (err) {
            return [
              simulation.simulationId,
              {
                isLoading: false,
                error: err instanceof Error ? err.message : "Unable to load simulation snapshot.",
                frame: null,
                arenaBounds: null,
              },
            ] as const;
          }
        }),
      );

      setSimulationPreviewById(Object.fromEntries(previewEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load simulations.");
      setSimulationPreviewById({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: MySimulationsContextType = {
    simulations,
    simulationPreviewById,
    isLoading,
    error,
    load,
  };

  return <MySimulationsContext.Provider value={value}>{children}</MySimulationsContext.Provider>;
};
