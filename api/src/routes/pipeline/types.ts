import type { PipelineStartPayload } from "@ijf/shared";

export type PipelineStartRequest = PipelineStartPayload;

export type PipelineSpecsheetRequest = {
  id: number;
  characterDescription: string;
};

export type PipelineStartResponse = {
  status: "started";
};
