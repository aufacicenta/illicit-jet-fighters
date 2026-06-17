import { type BroadcastInitData, type ReplayFrame, type SpritesheetManifest } from "@ijf/shared";

import { apiRoutes } from "../../hooks/useRoutes";
import { authHeadersJson, readErrorText } from "./client";
import { type SimulationStatusResponse } from "./types";

export const fetchSimulationStatus = async (
  broadcastId: string,
): Promise<SimulationStatusResponse> => {
  const response = await fetch(apiRoutes.simulationStatus(broadcastId), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...authHeadersJson(),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  return (await response.json()) as SimulationStatusResponse;
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
      strikecraftTopSpriteThumbnailUrl?: string | null;
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
        strikecraftTopSpriteThumbnailUrl?: string | null;
      }
    >;
  };
};
