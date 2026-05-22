import type { BattlefieldPipelineStartPayload } from "@ijf/shared";

export type BattlefieldPipelineStartRequest = BattlefieldPipelineStartPayload;

export type BattlefieldPipelineSheetRequest = {
  id: number;
};

export type BattlefieldPipelineConfigRequest = {
  id: number;
};

export type BattlefieldPipelineStartResponse = {
  status: "started";
};
