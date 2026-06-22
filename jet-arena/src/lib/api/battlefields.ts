import { apiRoutes } from "../../hooks/useRoutes";
import { authHeadersJson, get, post, readErrorText } from "./client";
import type { BattlefieldListResponse } from "./types";

export const battlefieldSessionPost = async () =>
  post<{ id: number }>(apiRoutes.battlefieldSession, {});

export const battlefieldCreatePost = async () => post<{ id: number }>(apiRoutes.battlefields, {});

export const fetchMyBattlefields = async () => get<BattlefieldListResponse>(apiRoutes.battlefields);

export const deleteBattlefield = async (battlefieldId: number): Promise<void> => {
  const response = await fetch(apiRoutes.battlefield(battlefieldId), {
    method: "DELETE",
    headers: {
      ...authHeadersJson(),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }
};
