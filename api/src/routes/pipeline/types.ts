import type { PipelineStartPayload } from "@ijf/shared";

export type PipelineStartRequest = PipelineStartPayload;

export type PipelineSpecsheetRequest = {
  id: number;
  characterDescription: string;
};

export type PipelineAgentCodeRequest = {
  id: number;
};

export type PipelineSpritesheetImageRequest = {
  id: number;
};

export type PipelineStrikecraftSpriteImageRequest = {
  id: number;
};

export type PipelineStartResponse = {
  status: "started";
};
