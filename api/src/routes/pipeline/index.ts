import { Elysia } from "elysia";

import { startPipeline } from "../../lib/pipeline-runner";
import type { PipelineStartRequest, PipelineStartResponse } from "./types";

export const pipelineRoute = new Elysia({ prefix: "/pipeline" }).post("/start", ({ body }) => {
  const { fighterId, prompt } = body as PipelineStartRequest;
  void startPipeline(fighterId, prompt);
  return { status: "started" } satisfies PipelineStartResponse;
});
