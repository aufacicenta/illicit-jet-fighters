import { apiRoutes } from "../../hooks/useRoutes";
import { post } from "./client";

export const battlefieldSessionPost = async () =>
  post<{ id: number }>(apiRoutes.battlefieldSession, {});

export const battlefieldCreatePost = async () => post<{ id: number }>(apiRoutes.battlefields, {});
