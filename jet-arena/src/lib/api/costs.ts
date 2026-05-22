import { apiRoutes } from "../../hooks/useRoutes";
import { authHeadersJson, readErrorText } from "./client";
import type { FighterCostSnapshot } from "./types";

export const fetchFighterCosts = async (fighterId: string): Promise<FighterCostSnapshot | null> => {
  const response = await fetch(apiRoutes.fighterCosts(fighterId), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...authHeadersJson(),
    },
  });

  if (response.status === 404 || response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  return (await response.json()) as FighterCostSnapshot;
};
