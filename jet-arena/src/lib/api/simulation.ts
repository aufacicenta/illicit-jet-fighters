import { type ReplayFrame } from "@ijf/shared";

import { apiRoutes } from "../../hooks/useRoutes";
import { authHeadersJson, post, readErrorText } from "./client";
import { type SimulationStartResponse } from "./types";

export const simulationStartPost = async (
  fighterId: number,
  seed?: number,
): Promise<SimulationStartResponse> =>
  post<SimulationStartResponse>(apiRoutes.simulations, {
    fighterId,
    seed,
  });

export const fetchSimulationReplay = async (
  simulationId: string,
): Promise<{ frames: ReplayFrame[] }> => {
  const response = await fetch(apiRoutes.simulationReplay(simulationId), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...authHeadersJson(),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  return (await response.json()) as { frames: ReplayFrame[] };
};
