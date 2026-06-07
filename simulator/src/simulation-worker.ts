import type { AgentAction, GameState, Observation, ReplayFrame } from "@ijf/shared/simulation";
import { CONFIG, IDLE_ACTION } from "@ijf/shared/simulation";

import { computeReward } from "./rewards";
import type {
  AgentWorkerResponseMessage,
  SimulationPlayerConfig,
  SimulationWorkerRequestMessage,
  SimulationWorkerResponseMessage,
  StartSimulationInput,
  WorkerActionResponseMessage,
} from "./simulation.types";
import { GameWorld } from "./world";

type PendingResult = {
  action: AgentAction;
  reward: number;
};

const cloneState = (state: GameState): GameState => ({
  tick: state.tick,
  arenaBounds: { ...state.arenaBounds },
  jets: new Map(
    [...state.jets.entries()].map(([id, jet]) => [
      id,
      {
        ...jet,
        pickupsCollected: { ...jet.pickupsCollected },
      },
    ]),
  ),
  bullets: state.bullets.map((bullet) => ({ ...bullet })),
  recentHitEvents: state.recentHitEvents.map((event) => ({ ...event })),
  pickups: state.pickups.map((pickup) => ({ ...pickup })),
  pickupStats: {
    totalSpawned: { ...state.pickupStats.totalSpawned },
    totalCollected: { ...state.pickupStats.totalCollected },
  },
});

const hashReplay = async (frames: ReplayFrame[]): Promise<string> => {
  const json = JSON.stringify(frames);
  const encoded = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const CHECKPOINT_EXPORT_TIMEOUT_MS = 3000;

class SimulationWorkerRuntime {
  private world: GameWorld | null = null;
  private workers: Map<string, Worker> = new Map();
  private workerReady: Map<string, boolean> = new Map();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private requestId = 0;
  private previousState: GameState | null = null;
  private lastResults = new Map<string, PendingResult>();
  private inFlight = false;
  private broadcastId = "";
  private fighterIdByPlayerId = new Map<string, number | null>();

  async start(input: StartSimulationInput): Promise<void> {
    this.stop();
    this.broadcastId = input.broadcastId;
    this.fighterIdByPlayerId = new Map(
      input.players.map((player) => [player.id, player.fighterId ?? null]),
    );
    this.world = new GameWorld(
      input.players.map((player) => player.id),
      input.seed,
      input.battlefield,
      input.pickupConfig,
    );
    this.previousState = cloneState(this.world.state);
    this.lastResults.clear();

    for (const player of input.players) {
      this.createWorkerForPlayer(player);
    }

    const initMessage: SimulationWorkerResponseMessage = {
      type: "INIT",
      broadcastId: input.broadcastId,
      data: {
        battlefieldConfig: input.battlefield,
        playerIds: input.players.map((player) => player.id),
        playerMetaById: input.playerMetaById,
        arenaBounds: this.world.state.arenaBounds,
        pickupStats: this.world.state.pickupStats,
      },
    };
    self.postMessage(initMessage);

    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, 1000 / CONFIG.TICK_RATE);
  }

  private stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    for (const worker of this.workers.values()) {
      worker.terminate();
    }
    this.workers.clear();
    this.workerReady.clear();
    this.inFlight = false;
  }

  private async tick(): Promise<void> {
    if (!this.world || !this.previousState || this.inFlight) {
      return;
    }
    this.inFlight = true;

    const actions = new Map<string, AgentAction>();
    const requests: Promise<void>[] = [];

    for (const [id, worker] of this.workers.entries()) {
      const jet = this.world.state.jets.get(id);
      if (!jet || !jet.alive) continue;

      const observation = this.buildObservation(id, this.world.state);
      const previous = this.lastResults.get(id) ?? {
        action: IDLE_ACTION,
        reward: 0,
      };

      requests.push(
        this.requestAction(id, worker, observation, previous.reward).then((action) => {
          actions.set(id, action);
          this.lastResults.set(id, {
            action,
            reward: previous.reward,
          });
        }),
      );
    }

    await Promise.all(requests);
    const previousForReward = this.previousState;
    const currentState = this.world.step(actions);

    for (const [id, result] of this.lastResults.entries()) {
      const nearestWallDistance = this.world.getJetNearestWallDistance(id);
      const reward = computeReward(
        id,
        previousForReward,
        currentState,
        result.action,
        nearestWallDistance,
      );
      this.lastResults.set(id, { action: result.action, reward });
    }

    const frame = this.world.replayLog[this.world.replayLog.length - 1];
    if (frame) {
      const frameWithFighterIds: ReplayFrame = {
        ...frame,
        jets: frame.jets.map((jet) => ({
          ...jet,
          fighterId: this.fighterIdByPlayerId.get(jet.id) ?? null,
        })),
      };
      this.world.replayLog[this.world.replayLog.length - 1] = frameWithFighterIds;
      self.postMessage({
        type: "FRAME",
        broadcastId: this.broadcastId,
        data: frameWithFighterIds,
      } satisfies SimulationWorkerResponseMessage);
    }

    this.previousState = cloneState(currentState);
    const winnerId = this.world.getWinnerId();
    if (this.world.isTerminalState()) {
      const replayHashHex = await hashReplay(this.world.replayLog);
      const checkpoints = await this.exportCheckpoints();
      self.postMessage({
        type: "END",
        broadcastId: this.broadcastId,
        data: {
          winnerId,
          winnerFighterId: winnerId ? (this.fighterIdByPlayerId.get(winnerId) ?? null) : null,
          replayHashHex,
          frames: this.world.replayLog,
          checkpoints,
        },
      } satisfies SimulationWorkerResponseMessage);
      this.stop();
      this.inFlight = false;
      return;
    }

    this.inFlight = false;
  }

  private createWorkerForPlayer(player: SimulationPlayerConfig): void {
    const worker = new Worker(new URL("./agent-worker.ts", import.meta.url), {
      type: "module",
    });
    this.workerReady.set(player.id, false);

    worker.addEventListener("message", (event: MessageEvent<AgentWorkerResponseMessage>) => {
      if (event.data.type === "AGENT_READY") {
        this.workerReady.set(player.id, true);
      }
      if (event.data.type === "AGENT_ERROR") {
        this.workerReady.set(player.id, false);
      }
    });

    worker.addEventListener("error", () => {
      this.workerReady.set(player.id, false);
    });

    worker.postMessage({
      type: "LOAD_AGENT",
      payload: { code: player.code, checkpoint: player.checkpoint ?? null },
    });
    this.workers.set(player.id, worker);
  }

  private exportCheckpoints(): Promise<Record<string, string | null>> {
    const entries = [...this.workers.entries()];
    if (entries.length === 0) {
      return Promise.resolve({});
    }

    return Promise.all(
      entries.map(async ([playerId, worker]) => {
        const data = await this.requestCheckpointExport(worker);
        return [playerId, data] as const;
      }),
    ).then((results) => Object.fromEntries(results));
  }

  private requestCheckpointExport(worker: Worker): Promise<string | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        worker.removeEventListener("message", onMessage);
        resolve(null);
      }, CHECKPOINT_EXPORT_TIMEOUT_MS);

      const onMessage = (event: MessageEvent<AgentWorkerResponseMessage>) => {
        if (event.data.type !== "CHECKPOINT_DATA") return;
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        resolve(event.data.payload.data);
      };

      worker.addEventListener("message", onMessage);
      worker.postMessage({ type: "EXPORT_CHECKPOINT" });
    });
  }

  private requestAction(
    playerId: string,
    worker: Worker,
    observation: Observation,
    reward: number,
  ): Promise<AgentAction> {
    if (this.workerReady.get(playerId) === false) {
      return Promise.resolve(IDLE_ACTION);
    }
    const requestId = ++this.requestId;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        worker.removeEventListener("message", onMessage);
        resolve(IDLE_ACTION);
      }, CONFIG.ACTION_TIMEOUT_MS);

      const onMessage = (event: MessageEvent<WorkerActionResponseMessage>) => {
        if (event.data.type !== "ACTION") return;
        if (event.data.payload.requestId !== requestId) return;
        clearTimeout(timeout);
        worker.removeEventListener("message", onMessage);
        resolve({
          thrust: Math.max(-1, Math.min(1, Number(event.data.payload.action.thrust) || 0)),
          turn: Math.max(-1, Math.min(1, Number(event.data.payload.action.turn) || 0)),
          climb: Math.max(-1, Math.min(1, Number(event.data.payload.action.climb) || 0)),
          shoot: Boolean(event.data.payload.action.shoot),
        });
      };

      worker.addEventListener("message", onMessage);
      worker.postMessage({
        type: "TICK",
        payload: { requestId, observation, reward },
      });
    });
  }

  private buildObservation(jetId: string, state: GameState): Observation {
    const selfJet = state.jets.get(jetId);
    if (!selfJet) {
      throw new Error(`Missing self jet for ${jetId}`);
    }
    if (!this.world) {
      throw new Error("Game world unavailable while building observation.");
    }

    const enemies = [...state.jets.values()]
      .filter((jet) => jet.id !== jetId)
      .map((jet) => {
        const relX = jet.x - selfJet.x;
        const relY = jet.y - selfJet.y;
        const distance = Math.hypot(relX, relY);
        const angleToEnemy = Math.atan2(relY, relX);
        const bearing = angleToEnemy - selfJet.angle;
        return {
          relX,
          relY,
          relAltitude: jet.altitude - selfJet.altitude,
          relVx: jet.vx - selfJet.vx,
          relVy: jet.vy - selfJet.vy,
          angle: jet.angle,
          distance,
          bearingAngle: Math.atan2(Math.sin(bearing), Math.cos(bearing)),
          alive: jet.alive,
        };
      });

    const nearbyBullets = state.bullets
      .filter((bullet) => {
        const dx = bullet.x - selfJet.x;
        const dy = bullet.y - selfJet.y;
        return dx * dx + dy * dy <= CONFIG.SENSOR_RANGE ** 2;
      })
      .map((bullet) => ({
        relX: bullet.x - selfJet.x,
        relY: bullet.y - selfJet.y,
        relAltitude: bullet.altitude - selfJet.altitude,
        relVx: bullet.vx - selfJet.vx,
        relVy: bullet.vy - selfJet.vy,
        isMine: bullet.ownerId === jetId,
      }));

    const nearbyPickups = state.pickups
      .filter((pickup) => {
        const dx = pickup.x - selfJet.x;
        const dy = pickup.y - selfJet.y;
        return dx * dx + dy * dy <= CONFIG.SENSOR_RANGE ** 2;
      })
      .map((pickup) => ({
        relX: pickup.x - selfJet.x,
        relY: pickup.y - selfJet.y,
        relAltitude: pickup.altitude - selfJet.altitude,
        kind: pickup.kind,
        distance: Math.hypot(pickup.x - selfJet.x, pickup.y - selfJet.y),
      }));

    const nearbyWalls = this.world.getNearbyWalls(
      selfJet.x,
      selfJet.y,
      selfJet.altitude,
      CONFIG.SENSOR_RANGE,
    );
    const nearestWall = nearbyWalls[0] ??
      this.world.getNearbyWalls(
        selfJet.x,
        selfJet.y,
        selfJet.altitude,
        Number.POSITIVE_INFINITY,
      )[0] ?? {
        distance: Number.POSITIVE_INFINITY,
        normalX: 0,
        normalY: 0,
        contactX: selfJet.x,
        contactY: selfJet.y,
        wallType: "boundary" as const,
        altitudeMin: 0,
        altitudeMax: 1,
      };
    const nearestWallAltitudeMin = nearestWall.altitudeMin ?? 0;
    const nearestWallAltitudeMax = nearestWall.altitudeMax ?? 1;
    const result = this.lastResults.get(jetId);

    return {
      self: {
        vx: selfJet.vx,
        vy: selfJet.vy,
        speed: Math.hypot(selfJet.vx, selfJet.vy),
        angle: selfJet.angle,
        altitude: selfJet.altitude,
        vAlt: selfJet.vAlt,
        health: selfJet.health,
        ammo: selfJet.ammo,
        fuel: selfJet.fuel,
        weight: selfJet.weight,
        cooldown: selfJet.cooldown,
        collisionCount: selfJet.collisionCount,
        collisionDamageTaken: selfJet.collisionDamageTaken,
        enemyHitsLanded: selfJet.enemyHitsLanded,
        enemyHitsTaken: selfJet.enemyHitsTaken,
        lastHitDealtToId: selfJet.lastHitDealtToId,
        lastHitTakenFromId: selfJet.lastHitTakenFromId,
        lastHitDealtTick: selfJet.lastHitDealtTick,
        lastHitTakenTick: selfJet.lastHitTakenTick,
      },
      enemies,
      nearbyBullets,
      nearbyPickups,
      nearestWall,
      nearbyWalls,
      distanceToWall: nearestWall.distance,
      nearestWallAltitudeBand: {
        altitudeMin: nearestWallAltitudeMin,
        altitudeMax: nearestWallAltitudeMax,
        deltaToMin: selfJet.altitude - nearestWallAltitudeMin,
        deltaToMax: nearestWallAltitudeMax - selfJet.altitude,
        belowBand: selfJet.altitude < nearestWallAltitudeMin,
        withinBand:
          selfJet.altitude >= nearestWallAltitudeMin && selfJet.altitude <= nearestWallAltitudeMax,
        aboveBand: selfJet.altitude > nearestWallAltitudeMax,
      },
      lastCollision: selfJet.lastCollision,
      tick: state.tick,
      lastAction: result?.action ?? null,
      lastReward: result?.reward ?? 0,
    };
  }
}

const runtime = new SimulationWorkerRuntime();
self.onmessage = (event: MessageEvent<SimulationWorkerRequestMessage>) => {
  if (event.data.type !== "START") {
    return;
  }

  void runtime.start(event.data.payload).catch((error) => {
    self.postMessage({
      type: "ERROR",
      broadcastId: event.data.payload.broadcastId,
      data: { message: error instanceof Error ? error.message : "Simulation worker failed." },
    } satisfies SimulationWorkerResponseMessage);
  });
};
