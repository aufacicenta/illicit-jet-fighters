import {
  type PublicFighterDetail,
  publicFighterDetailSchema,
  type PublicFightersResponse,
  publicFightersResponseSchema,
} from "@ijf/shared";

import { apiRoutes } from "../../hooks/useRoutes";
import { readErrorText } from "./client";

export type PublicFightersQuery = {
  sort?: "latest" | "wins";
  limit?: number;
  offset?: number;
};

const buildPublicFightersUrl = ({ sort, limit, offset }: PublicFightersQuery = {}) => {
  const params = new URLSearchParams();
  if (sort) {
    params.set("sort", sort);
  }
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  if (typeof offset === "number") {
    params.set("offset", String(offset));
  }

  const query = params.toString();
  return query.length > 0 ? `${apiRoutes.publicFighters}?${query}` : apiRoutes.publicFighters;
};

export const fetchPublicFighters = async (
  query: PublicFightersQuery = {},
): Promise<PublicFightersResponse> => {
  const response = await fetch(buildPublicFightersUrl(query), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  const payload = (await response.json()) as unknown;
  return publicFightersResponseSchema.parse(payload);
};

export const fetchPublicFighterDetail = async (fighterId: number): Promise<PublicFighterDetail> => {
  const response = await fetch(apiRoutes.publicFighter(fighterId), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  const payload = (await response.json()) as unknown;
  return publicFighterDetailSchema.parse(payload);
};
