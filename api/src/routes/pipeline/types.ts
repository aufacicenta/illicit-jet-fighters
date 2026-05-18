export type PipelineStartRequest = {
  id: number;
  prompt: string;
};

export type PipelineSpecsheetRequest = {
  id: number;
  characterDescription: string;
};

export type PipelineStartResponse = {
  status: "started";
};
