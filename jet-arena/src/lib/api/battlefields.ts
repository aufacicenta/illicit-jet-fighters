import { apiRoutes } from "../../hooks/useRoutes";
import { get, post } from "./client";
import type { BattlefieldListResponse } from "./types";

export const battlefieldSessionPost = async () =>
  post<{ id: number }>(apiRoutes.battlefieldSession, {});

export const battlefieldCreatePost = async () => post<{ id: number }>(apiRoutes.battlefields, {});

export const fetchMyBattlefields = async () => get<BattlefieldListResponse>(apiRoutes.battlefields);
