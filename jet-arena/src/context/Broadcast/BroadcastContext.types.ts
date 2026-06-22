import type { BroadcastInitData, ReplayFrame, SpritesheetManifest } from "@ijf/shared";
import type { ReactNode } from "react";

import type { SimulationStatusResponse } from "../../lib/api/types";

export type BroadcastContextControllerProps = {
  children: ReactNode;
  broadcastId: string | undefined;
};

export type EndSummary = {
  winnerId: string | null;
  winnerFighterId: number | null;
  replayHashHex: string;
} | null;

export type RenderBootstrapData = Pick<
  BroadcastInitData,
  "battlefieldConfig" | "arenaBounds" | "pickupStats"
>;

export type PlayerMetaById = Record<
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

export type BroadcastContextType = {
  frames: ReplayFrame[];
  frameIndex: number;
  isFollowingLive: boolean;
  isPlayingReplay: boolean;
  playbackSpeed: number;
  endSummary: EndSummary;
  errorMessage: string | null;
  playerMetaById: PlayerMetaById;
  renderBootstrapData: RenderBootstrapData | null;
  statusSnapshot: SimulationStatusResponse | null;
  isBroadcastConnected: boolean;
  hasLiveFeed: boolean;
  liveLabel: string;
  centerTitle: string;
  currentFrame: ReplayFrame | undefined;
  leftJets: ReplayFrame["jets"];
  rightJets: ReplayFrame["jets"];
  jetLabelsById: Map<string, string>;
  onSliderChange: (nextIndex: number) => void;
  stepBack: () => void;
  stepForward: () => void;
  cycleSpeed: () => void;
  toggleReplayPlayback: () => void;
  jumpToLive: () => void;
  refreshPlayerMeta: () => Promise<void>;
};
