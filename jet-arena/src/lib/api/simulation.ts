import { type BroadcastInitData, type ReplayFrame, type SpritesheetManifest } from "@ijf/shared";

import { apiRoutes } from "../../hooks/useRoutes";
import { authHeadersJson, post, readErrorText } from "./client";
import {
  type SimulationListResponse,
  type SimulationParticipantInput,
  type SimulationStartRequest,
  type SimulationStartResponse,
} from "./types";

export const simulationStartPost = async ({
  participants,
  seed,
}: SimulationStartRequest): Promise<SimulationStartResponse> =>
  post<SimulationStartResponse>(apiRoutes.simulations, {
    participants: participants.map((participant: SimulationParticipantInput) => ({
      fighterId: participant.fighterId,
      agentVersionId: participant.agentVersionId ?? null,
    })),
    seed,
  });

export const fetchMySimulations = async (limit = 24): Promise<SimulationListResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  const response = await fetch(`${apiRoutes.simulations}?${searchParams.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...authHeadersJson(),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  return (await response.json()) as SimulationListResponse;
};

export const fetchSimulationReplay = async (
  simulationId: string,
): Promise<{
  frames: ReplayFrame[];
  initData?: BroadcastInitData | null;
  playerMetaById?: Record<
    string,
    {
      fighterId: number;
      fighterName: string | null;
      agentVersionNumber: number | null;
      displayLabel: string | null;
      spritesheetImageUrl: string | null;
      spritesheetManifestUrl: string | null;
      spritesheetManifest: SpritesheetManifest | null;
      strikecraftTopSpriteUrl: string | null;
    }
  >;
}> => {
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

  return (await response.json()) as {
    frames: ReplayFrame[];
    initData?: BroadcastInitData | null;
    playerMetaById?: Record<
      string,
      {
        fighterId: number;
        fighterName: string | null;
        agentVersionNumber: number | null;
        displayLabel: string | null;
        spritesheetImageUrl: string | null;
        spritesheetManifestUrl: string | null;
        spritesheetManifest: SpritesheetManifest | null;
        strikecraftTopSpriteUrl: string | null;
      }
    >;
  };
};
