import type {
  BattlefieldConfig,
  BroadcastMessage,
  PickupConfig,
  ReplayFrame,
} from "@ijf/shared/simulation";

import { DEFAULT_BATTLEFIELD } from "./default-battlefield";
import type {
  SimulationPlayerConfig,
  SimulationSummary,
  SimulationWorkerResponseMessage,
} from "./simulation.types";
import { publishBroadcastMessage } from "./ws/broadcast-hub";

type SimulationRecord = {
  worker: Worker;
  summary: SimulationSummary;
  frames: ReplayFrame[];
};

export type StartSimulationArgs = {
  broadcastId: string;
  players: SimulationPlayerConfig[];
  seed: number;
  battlefield?: BattlefieldConfig;
  pickupConfig?: PickupConfig;
};

const FALLBACK_AGENT_CODE = `
self.__agentExport = {
  init: () => {},
  act: () => ({ thrust: 0.2, turn: 0.05, climb: 0, shoot: false }),
  learn: () => {},
};
`;

const buildDefaultPlayers = (): SimulationPlayerConfig[] =>
  [1, 2, 3, 4].map((index) => ({
    id: `jet-${index}-fallback`,
    code: FALLBACK_AGENT_CODE,
  }));

class SimulationManager {
  private simulations = new Map<string, SimulationRecord>();
  private maxConcurrentSimulations = 16;

  setMaxConcurrentSimulations(maxConcurrentSimulations: number): void {
    this.maxConcurrentSimulations = Math.max(1, Math.floor(maxConcurrentSimulations));
  }

  startSimulation(args: StartSimulationArgs): SimulationSummary {
    if (this.simulations.has(args.broadcastId)) {
      const existing = this.simulations.get(args.broadcastId);
      if (!existing) {
        throw new Error("Simulation map lookup failed unexpectedly.");
      }
      return existing.summary;
    }

    if (this.runningCount() >= this.maxConcurrentSimulations) {
      throw new Error("Simulation capacity reached. Please retry shortly.");
    }

    const startedAt = Date.now();
    const summary: SimulationSummary = {
      broadcastId: args.broadcastId,
      status: "running",
      winnerId: null,
      startedAt,
      endedAt: null,
      replayHashHex: null,
      replayLength: 0,
      errorMessage: null,
    };
    const worker = new Worker(new URL("./simulation-worker.ts", import.meta.url), {
      type: "module",
    });
    const record: SimulationRecord = {
      worker,
      summary,
      frames: [],
    };
    this.simulations.set(args.broadcastId, record);

    worker.addEventListener("message", (event: MessageEvent<SimulationWorkerResponseMessage>) => {
      this.handleWorkerMessage(event.data);
    });
    worker.addEventListener("error", (event) => {
      this.markErrored(args.broadcastId, event.message || "Simulation worker crashed.");
    });

    worker.postMessage({
      type: "START",
      payload: {
        broadcastId: args.broadcastId,
        players: args.players.length > 0 ? args.players : buildDefaultPlayers(),
        seed: Number.isFinite(args.seed) ? args.seed : 1337,
        battlefield: args.battlefield ?? DEFAULT_BATTLEFIELD,
        pickupConfig: args.pickupConfig,
      },
    });

    return summary;
  }

  getSummary(broadcastId: string): SimulationSummary | null {
    return this.simulations.get(broadcastId)?.summary ?? null;
  }

  getReplay(broadcastId: string): ReplayFrame[] | null {
    const record = this.simulations.get(broadcastId);
    if (!record) return null;
    return record.frames;
  }

  private handleWorkerMessage(message: SimulationWorkerResponseMessage): void {
    const record = this.simulations.get(message.broadcastId);
    if (!record) return;

    if (message.type === "INIT") {
      publishBroadcastMessage(message.broadcastId, {
        type: "init",
        data: message.data,
      } satisfies BroadcastMessage);
      return;
    }

    if (message.type === "FRAME") {
      record.frames.push(message.data);
      record.summary.replayLength = record.frames.length;
      publishBroadcastMessage(message.broadcastId, {
        type: "frame",
        data: message.data,
      } satisfies BroadcastMessage);
      return;
    }

    if (message.type === "END") {
      record.summary.status = "ended";
      record.summary.endedAt = Date.now();
      record.summary.winnerId = message.data.winnerId;
      record.summary.replayHashHex = message.data.replayHashHex;
      record.summary.replayLength = message.data.frames.length;
      record.frames = message.data.frames;
      publishBroadcastMessage(message.broadcastId, {
        type: "end",
        data: {
          winnerId: message.data.winnerId,
          replayHashHex: message.data.replayHashHex,
        },
      } satisfies BroadcastMessage);
      record.worker.terminate();
      return;
    }

    if (message.type === "ERROR") {
      this.markErrored(message.broadcastId, message.data.message);
    }
  }

  private markErrored(broadcastId: string, message: string): void {
    const record = this.simulations.get(broadcastId);
    if (!record) return;
    record.summary.status = "error";
    record.summary.errorMessage = message;
    record.summary.endedAt = Date.now();
    publishBroadcastMessage(broadcastId, {
      type: "error",
      data: { message },
    });
    record.worker.terminate();
  }

  private runningCount(): number {
    let count = 0;
    for (const { summary } of this.simulations.values()) {
      if (summary.status === "running") count += 1;
    }
    return count;
  }
}

export const simulationManager = new SimulationManager();
