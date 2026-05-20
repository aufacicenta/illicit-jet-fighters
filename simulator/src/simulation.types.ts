import type {
  AgentAction,
  BattlefieldConfig,
  BroadcastInitData,
  BroadcastMessage,
  Observation,
  PickupConfig,
  ReplayFrame,
} from "@ijf/shared/simulation";

export type SimulationPlayerConfig = {
  id: string;
  code: string;
};

export type StartSimulationInput = {
  broadcastId: string;
  players: SimulationPlayerConfig[];
  seed: number;
  battlefield: BattlefieldConfig;
  pickupConfig?: PickupConfig;
};

export type WorkerActionResponseMessage = {
  type: "ACTION";
  payload: { requestId: number; action: AgentAction };
};

export type AgentWorkerRequestMessage =
  | { type: "LOAD_AGENT"; payload: { code: string } }
  | { type: "TICK"; payload: { requestId: number; observation: Observation; reward: number } };

export type AgentWorkerResponseMessage =
  | { type: "AGENT_READY" }
  | { type: "AGENT_ERROR"; payload: { error: string } }
  | WorkerActionResponseMessage;

export type SimulationWorkerRequestMessage = {
  type: "START";
  payload: StartSimulationInput;
};

export type SimulationWorkerResponseMessage =
  | { type: "INIT"; broadcastId: string; data: BroadcastInitData }
  | { type: "FRAME"; broadcastId: string; data: ReplayFrame }
  | {
      type: "END";
      broadcastId: string;
      data: { winnerId: string | null; replayHashHex: string; frames: ReplayFrame[] };
    }
  | { type: "ERROR"; broadcastId: string; data: { message: string } };

export type SimulationStatus = "queued" | "running" | "ended" | "error";

export type SimulationSummary = {
  broadcastId: string;
  status: SimulationStatus;
  winnerId: string | null;
  startedAt: number;
  endedAt: number | null;
  replayHashHex: string | null;
  replayLength: number;
  errorMessage: string | null;
};

export type BroadcastPayload = BroadcastMessage;
