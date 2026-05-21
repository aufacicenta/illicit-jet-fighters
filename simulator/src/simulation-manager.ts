import type {
  BattlefieldConfig,
  BroadcastMessage,
  PickupConfig,
  ReplayFrame,
  SpritesheetManifest,
} from "@ijf/shared/simulation";

import { DEFAULT_BATTLEFIELD } from "./default-battlefield";
import type {
  SimulationPlayerConfig,
  SimulationSummary,
  SimulationWorkerResponseMessage,
} from "./simulation.types";
import { publishBroadcastMessage } from "./ws/broadcast-hub";

export type SimulationLifecycleHandlers = {
  onStart?: (summary: SimulationSummary) => void | Promise<void>;
  onInit?: (
    message: Extract<SimulationWorkerResponseMessage, { type: "INIT" }>,
  ) => void | Promise<void>;
  onFrame?: (
    message: Extract<SimulationWorkerResponseMessage, { type: "FRAME" }>,
  ) => void | Promise<void>;
  onEnd?: (
    message: Extract<SimulationWorkerResponseMessage, { type: "END" }>,
  ) => void | Promise<void>;
  onError?: (
    message: Extract<SimulationWorkerResponseMessage, { type: "ERROR" }>,
  ) => void | Promise<void>;
};

type SimulationRecord = {
  worker: Worker;
  summary: SimulationSummary;
  frames: ReplayFrame[];
  lifecycle?: SimulationLifecycleHandlers;
};

export type StartSimulationArgs = {
  broadcastId: string;
  players: SimulationPlayerConfig[];
  playerMetaById?: Record<
    string,
    {
      fighterId: number;
      spritesheetImageUrl: string | null;
      spritesheetManifestUrl: string | null;
      spritesheetManifest: SpritesheetManifest | null;
      strikecraftTopSpriteUrl: string | null;
    }
  >;
  seed: number;
  battlefield?: BattlefieldConfig;
  pickupConfig?: PickupConfig;
  lifecycle?: SimulationLifecycleHandlers;
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
    fighterId: null,
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
      lifecycle: args.lifecycle,
    };
    this.simulations.set(args.broadcastId, record);
    this.fire(record.lifecycle?.onStart, summary);

    worker.addEventListener("message", (event: MessageEvent<SimulationWorkerResponseMessage>) => {
      this.handleWorkerMessage(event.data);
    });
    worker.addEventListener("error", (event) => {
      this.markErrored(args.broadcastId, event.message || "Simulation worker crashed.");
    });

    const resolvedPlayers = args.players.length > 0 ? args.players : buildDefaultPlayers();
    const fallbackMetaById = Object.fromEntries(
      resolvedPlayers.map((player) => [
        player.id,
        {
          fighterId: player.fighterId ?? 0,
          spritesheetImageUrl: null,
          spritesheetManifestUrl: null,
          spritesheetManifest: null,
          strikecraftTopSpriteUrl: null,
        },
      ]),
    );
    worker.postMessage({
      type: "START",
      payload: {
        broadcastId: args.broadcastId,
        players: resolvedPlayers,
        playerMetaById: args.playerMetaById ?? fallbackMetaById,
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
      this.fire(record.lifecycle?.onInit, message);
      publishBroadcastMessage(message.broadcastId, {
        type: "init",
        data: message.data,
      } satisfies BroadcastMessage);
      return;
    }

    if (message.type === "FRAME") {
      this.fire(record.lifecycle?.onFrame, message);
      record.frames.push(message.data);
      record.summary.replayLength = record.frames.length;
      publishBroadcastMessage(message.broadcastId, {
        type: "frame",
        data: message.data,
      } satisfies BroadcastMessage);
      return;
    }

    if (message.type === "END") {
      this.fire(record.lifecycle?.onEnd, message);
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
    this.fire(record.lifecycle?.onError, {
      type: "ERROR",
      broadcastId,
      data: { message },
    });
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

  private fire<TPayload>(
    callback: ((payload: TPayload) => void | Promise<void>) | undefined,
    payload: TPayload,
  ): void {
    if (!callback) {
      return;
    }

    try {
      const result = callback(payload);
      if (result && typeof result === "object" && "catch" in result) {
        void (result as Promise<void>).catch(() => {});
      }
    } catch {
      // Lifecycle handlers are best-effort and should not crash simulations.
    }
  }
}

export const simulationManager = new SimulationManager();
