export type PipelineStartRequest = {
  fighterId: string;
  prompt: string;
};

export type PipelineStartResponse = {
  status: "started";
};
