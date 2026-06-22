import { battlefieldCostSnapshotSchema, fighterCostSnapshotSchema } from "@ijf/shared";

import { apiRoutes } from "../../hooks/useRoutes";
import { authHeadersJson, readErrorText } from "./client";
import type { BattlefieldCostSnapshot, FighterCostSnapshot } from "./types";

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

  return fighterCostSnapshotSchema.parse(await response.json()) as FighterCostSnapshot;
};

export const fetchBattlefieldCosts = async (
  battlefieldId: string,
): Promise<BattlefieldCostSnapshot | null> => {
  const response = await fetch(apiRoutes.battlefieldCosts(battlefieldId), {
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

  return battlefieldCostSnapshotSchema.parse(await response.json()) as BattlefieldCostSnapshot;
};
