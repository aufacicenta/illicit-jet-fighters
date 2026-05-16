import { lockdownWorkerNetwork } from "./network-lockdown";
import { CONFIG, IDLE_ACTION } from "./types";
import type { AgentAction, AgentModule, Observation } from "./types";

type WorkerMessage =
  | {
      type: "LOAD_AGENT";
      payload: { code: string };
    }
  | {
      type: "TICK";
      payload: { requestId: number; observation: Observation; reward: number };
    };

type WorkerResponse =
  | { type: "AGENT_READY" }
  | { type: "AGENT_ERROR"; payload: { error: string } }
  | { type: "ACTION"; payload: { requestId: number; action: AgentAction } };

let agent: AgentModule | null = null;

const sanitizeAction = (action: Partial<AgentAction> | undefined): AgentAction => ({
  thrust: Number.isFinite(action?.thrust) ? Math.max(-1, Math.min(1, Number(action?.thrust))) : 0,
  turn: Number.isFinite(action?.turn) ? Math.max(-1, Math.min(1, Number(action?.turn))) : 0,
  climb: Number.isFinite(action?.climb) ? Math.max(-1, Math.min(1, Number(action?.climb))) : 0,
  shoot: Boolean(action?.shoot),
});

const postResponse = (response: WorkerResponse): void => {
  self.postMessage(response);
};

const compileAgent = (code: string, tfLib: unknown): AgentModule => {
  (self as unknown as { __agentExport?: unknown }).__agentExport = undefined;
  const factory = new Function(
    "tf",
    "CONFIG",
    `"use strict";\n${code}\nreturn (self.__agentExport ?? null);`,
  );
  const loaded = factory(tfLib, CONFIG) as AgentModule | null;
  (self as unknown as { __agentExport?: unknown }).__agentExport = undefined;
  const resolved = loaded;
  if (!resolved || typeof resolved.init !== "function" || typeof resolved.act !== "function") {
    throw new Error("Agent must export init(), act(), and learn().");
  }
  if (typeof resolved.learn !== "function") {
    throw new Error("Agent must export learn().");
  }
  return resolved;
};

const handleLoadAgent = async (code: string): Promise<void> => {
  try {
    lockdownWorkerNetwork(self as DedicatedWorkerGlobalScope);
    const needsTensorFlow = /\btf\./.test(code);
    const tfLib = needsTensorFlow ? await import("@tensorflow/tfjs") : undefined;
    agent = compileAgent(code, tfLib);
    agent.init(CONFIG);
    postResponse({ type: "AGENT_READY" });
  } catch (error) {
    postResponse({
      type: "AGENT_ERROR",
      payload: { error: error instanceof Error ? error.message : String(error) },
    });
  }
};

const handleTick = (requestId: number, observation: Observation, reward: number): void => {
  if (!agent) {
    postResponse({
      type: "ACTION",
      payload: { requestId, action: IDLE_ACTION },
    });
    return;
  }

  try {
    agent.learn(observation, reward);
    const action = sanitizeAction(agent.act(observation));
    postResponse({
      type: "ACTION",
      payload: { requestId, action },
    });
  } catch {
    postResponse({
      type: "ACTION",
      payload: { requestId, action: IDLE_ACTION },
    });
  }
};

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  if (event.data.type === "LOAD_AGENT") {
    void handleLoadAgent(event.data.payload.code);
  }
  if (event.data.type === "TICK") {
    const { requestId, observation, reward } = event.data.payload;
    handleTick(requestId, observation, reward);
  }
};
