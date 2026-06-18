import { type PublicArenaMatchesResponse, publicArenaMatchesResponseSchema } from "@ijf/shared";

import { apiRoutes } from "../../hooks/useRoutes";
import { readErrorText } from "./client";

export type PublicArenaMatchesQuery = {
  limit?: number;
};

const buildPublicArenaMatchesUrl = ({ limit }: PublicArenaMatchesQuery = {}) => {
  if (typeof limit !== "number") {
    return apiRoutes.publicArenaMatches;
  }

  const params = new URLSearchParams();
  params.set("limit", String(limit));
  return `${apiRoutes.publicArenaMatches}?${params.toString()}`;
};

export const fetchPublicArenaMatches = async (
  query: PublicArenaMatchesQuery = {},
): Promise<PublicArenaMatchesResponse> => {
  const response = await fetch(buildPublicArenaMatchesUrl(query), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  const payload = (await response.json()) as unknown;
  return publicArenaMatchesResponseSchema.parse(payload);
};
