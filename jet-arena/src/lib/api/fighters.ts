import {
  type FighterAgentVersionsResponse,
  fighterAgentVersionsResponseSchema,
  type FighterIntakeResponse,
  fighterIntakeResponseSchema,
  type MyFightersResponse,
  myFightersResponseSchema,
} from "@ijf/shared";

import { apiRoutes } from "../../hooks/useRoutes";
import { authHeadersJson, readErrorText } from "./client";

export const fighterIntakePost = async (): Promise<FighterIntakeResponse> => {
  const response = await fetch(apiRoutes.fighterIntake, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeadersJson(),
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  const payload = (await response.json()) as unknown;
  return fighterIntakeResponseSchema.parse(payload);
};

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
