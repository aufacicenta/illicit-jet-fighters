import {
  type FighterAgentVersionsResponse,
  fighterAgentVersionsResponseSchema,
  type MyFightersResponse,
  myFightersResponseSchema,
} from "@ijf/shared";

import { apiRoutes } from "../../hooks/useRoutes";
import { authHeadersJson, post, readErrorText } from "./client";

export const fighterSessionPost = async () => post<{ id: number }>(apiRoutes.fighterSession, {});

export const fighterCreatePost = async () => post<{ id: number }>(apiRoutes.fighters, {});

export const fetchMyFighters = async (): Promise<MyFightersResponse> => {
  const response = await fetch(apiRoutes.fighters, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...authHeadersJson(),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  const payload = (await response.json()) as unknown;
  return myFightersResponseSchema.parse(payload);
};

export const fetchFighterAgentVersions = async (
  fighterId: number,
): Promise<FighterAgentVersionsResponse> => {
  const response = await fetch(apiRoutes.fighterAgentVersions(fighterId), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...authHeadersJson(),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  const payload = (await response.json()) as unknown;
  return fighterAgentVersionsResponseSchema.parse(payload);
};

export const deleteFighter = async (fighterId: number): Promise<void> => {
  const response = await fetch(apiRoutes.fighter(fighterId), {
    method: "DELETE",
    headers: {
      ...authHeadersJson(),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }
};
