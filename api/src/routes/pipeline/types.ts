export type PipelineStartRequest = {
  fighterId: string;
  prompt: string;
};

export type PipelineSpecsheetRequest = {
  fighterId: string;
  characterDescription: string;
};

export type PipelineStartResponse = {
  status: "started";
};
