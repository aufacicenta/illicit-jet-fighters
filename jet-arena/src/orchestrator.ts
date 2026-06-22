import { disableNetworkLockdown, enableNetworkLockdown } from "./network-lockdown";
import { GameRenderer } from "./renderer";
import { computeReward } from "./rewards";
import { submitResult } from "./settlement";
import type {
  AgentAction,
  BattlefieldConfig,
  GameState,
  Observation,
  PickupConfig,
  ReplayFrame,
} from "./types";
import { CONFIG, IDLE_ACTION } from "./types";
import { GameWorld } from "./world";

interface PlayerConfig {
  id: string;
  code: string;
}

interface PendingResult {
  action: AgentAction;
  reward: number;
}

interface ActionResponseMessage {
  type: "ACTION";
  payload: { requestId: number; action: AgentAction };
}

interface UiCallbacks {
  onTick: (state: GameState) => void;
  onStatus: (message: string) => void;
  onGameEnd: (winnerId: string | null, replayHashHex: string) => void;
}

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

export class GameOrchestrator {
  private world: GameWorld | null = null;
  private workers: Map<string, Worker> = new Map();
  private workerReady: Map<string, boolean> = new Map();
  private expectedWorkers = 0;
  private networkLockActive = false;
  private renderer: GameRenderer | null = null;
  private intervalHandle: number | null = null;
  private requestId = 0;
  private previousState: GameState | null = null;
  private lastResults = new Map<string, PendingResult>();
  private inFlight = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private ui: UiCallbacks,
  ) {}

  async start(
    players: PlayerConfig[],
    seed: number,
    battlefield: BattlefieldConfig,
    jetSprites?: Map<string, HTMLImageElement>,
    pickupConfigOverride?: PickupConfig,
  ): Promise<void> {
    this.stop();
    // Ensure we never inherit a stale "game active" lock from a prior interrupted run.
    disableNetworkLockdown();
    this.world = new GameWorld(
      players.map((player) => player.id),
      seed,
      battlefield,
      pickupConfigOverride,
    );
    this.renderer = new GameRenderer(this.canvas, this.world.getArenaShape(), jetSprites);
    this.previousState = cloneState(this.world.state);
    this.lastResults.clear();
    this.expectedWorkers = players.length;
    this.networkLockActive = false;
    this.ui.onStatus("Starting match...");

    for (const player of players) {
      this.createWorkerForPlayer(player);
    }

    this.ui.onStatus("Match running (agents initializing in background)");
    this.renderer?.draw(this.world.state);
    this.intervalHandle = window.setInterval(() => {
      void this.tick();
    }, 1000 / CONFIG.TICK_RATE);
  }

  stop(): void {
    if (this.intervalHandle !== null) {
      window.clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    for (const worker of this.workers.values()) {
      worker.terminate();
    }
    this.workers.clear();
    this.workerReady.clear();
    this.expectedWorkers = 0;
    this.networkLockActive = false;
    this.inFlight = false;
    this.renderer = null;
    disableNetworkLockdown();
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

    this.previousState = cloneState(currentState);
    this.renderer?.draw(currentState);
    this.ui.onTick(currentState);

    const winnerId = this.world.getWinnerId();
    if (this.world.isTerminalState()) {
      await this.finishMatch(winnerId);
      this.inFlight = false;
      return;
    }

    this.inFlight = false;
  }

  private async finishMatch(winnerId: string | null): Promise<void> {
    if (!this.world) return;
    this.stop();
    const replayHashHex = await hashReplay(this.world.replayLog);
    this.ui.onStatus(winnerId ? `Game over. Winner: ${winnerId}` : "Game over. Draw.");
    this.ui.onGameEnd(winnerId, replayHashHex);
    submitResult({
      winnerId,
      replayHashHex,
      replayLength: this.world.replayLog.length,
      endedAt: Date.now(),
    });
  }

  private createWorkerForPlayer(player: PlayerConfig): void {
    const worker = new Worker(new URL("./agent-worker.ts?v=7", import.meta.url), {
      type: "module",
    });
    this.workerReady.set(player.id, false);

    const startupTimer = window.setTimeout(() => {
      if (this.workerReady.get(player.id)) return;
      this.workerReady.set(player.id, false);
      this.ui.onStatus(`Agent ${player.id} startup timeout, running degraded mode`);
    }, 8000);

    worker.addEventListener(
      "message",
      (event: MessageEvent<{ type: string; payload?: unknown }>) => {
        if (event.data.type === "AGENT_READY") {
          window.clearTimeout(startupTimer);
          this.workerReady.set(player.id, true);
          const readyCount = [...this.workerReady.values()].filter(Boolean).length;
          this.ui.onStatus(`Agent ready: ${player.id} (${readyCount}/${this.expectedWorkers})`);
          if (
            !this.networkLockActive &&
            readyCount === this.expectedWorkers &&
            this.expectedWorkers > 0
          ) {
            enableNetworkLockdown();
            this.networkLockActive = true;
            this.ui.onStatus("All agents ready. Network lockdown active.");
          }
        }
        if (event.data.type === "AGENT_ERROR") {
          window.clearTimeout(startupTimer);
          this.workerReady.set(player.id, false);
          const payload = event.data.payload as { error?: string } | undefined;
          this.ui.onStatus(
            `Agent ${player.id} failed: ${payload?.error ?? "Unknown worker error"}`,
          );
        }
      },
    );

    worker.addEventListener("error", (event) => {
      window.clearTimeout(startupTimer);
      this.workerReady.set(player.id, false);
      this.ui.onStatus(`Agent ${player.id} worker error: ${event.message || "Unknown error"}`);
    });

    worker.postMessage({
      type: "LOAD_AGENT",
      payload: { code: player.code },
    });
    this.workers.set(player.id, worker);
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
      const timeout = window.setTimeout(() => {
        worker.removeEventListener("message", onMessage);
        resolve(IDLE_ACTION);
      }, CONFIG.ACTION_TIMEOUT_MS);

      const onMessage = (event: MessageEvent<ActionResponseMessage>) => {
        if (event.data.type !== "ACTION") return;
        if (event.data.payload.requestId !== requestId) return;
        window.clearTimeout(timeout);
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
    const self = state.jets.get(jetId);
    if (!self) {
      throw new Error(`Missing self jet for ${jetId}`);
    }

    const enemies = [...state.jets.values()]
      .filter((jet) => jet.id !== jetId)
      .map((jet) => {
        const relX = jet.x - self.x;
        const relY = jet.y - self.y;
        const distance = Math.hypot(relX, relY);
        const angleToEnemy = Math.atan2(relY, relX);
        const bearing = angleToEnemy - self.angle;
        return {
          relX,
          relY,
          relAltitude: jet.altitude - self.altitude,
          relVx: jet.vx - self.vx,
          relVy: jet.vy - self.vy,
          angle: jet.angle,
          distance,
          bearingAngle: Math.atan2(Math.sin(bearing), Math.cos(bearing)),
          alive: jet.alive,
        };
      });

    const nearbyBullets = state.bullets
      .filter((bullet) => {
        const dx = bullet.x - self.x;
        const dy = bullet.y - self.y;
        return dx * dx + dy * dy <= CONFIG.SENSOR_RANGE ** 2;
      })
      .map((bullet) => ({
        relX: bullet.x - self.x,
        relY: bullet.y - self.y,
        relAltitude: bullet.altitude - self.altitude,
        relVx: bullet.vx - self.vx,
        relVy: bullet.vy - self.vy,
        isMine: bullet.ownerId === jetId,
      }));

    const nearbyPickups = state.pickups
      .filter((pickup) => {
        const dx = pickup.x - self.x;
        const dy = pickup.y - self.y;
        return dx * dx + dy * dy <= CONFIG.SENSOR_RANGE ** 2;
      })
      .map((pickup) => ({
        relX: pickup.x - self.x,
        relY: pickup.y - self.y,
        relAltitude: pickup.altitude - self.altitude,
        kind: pickup.kind,
        distance: Math.hypot(pickup.x - self.x, pickup.y - self.y),
      }));

    if (!this.world) {
      throw new Error("Game world unavailable while building observation.");
    }
    const nearbyWalls = this.world.getNearbyWalls(
      self.x,
      self.y,
      self.altitude,
      CONFIG.SENSOR_RANGE,
    );
    const nearestWall = nearbyWalls[0] ??
      this.world.getNearbyWalls(self.x, self.y, self.altitude, Number.POSITIVE_INFINITY)[0] ?? {
        distance: Number.POSITIVE_INFINITY,
        normalX: 0,
        normalY: 0,
        contactX: self.x,
        contactY: self.y,
        wallType: "boundary" as const,
        altitudeMin: 0,
        altitudeMax: 1,
      };
    const nearestWallAltitudeMin = nearestWall.altitudeMin ?? 0;
    const nearestWallAltitudeMax = nearestWall.altitudeMax ?? 1;

    const result = this.lastResults.get(jetId);
    return {
      self: {
        vx: self.vx,
        vy: self.vy,
        speed: Math.hypot(self.vx, self.vy),
        angle: self.angle,
        altitude: self.altitude,
        vAlt: self.vAlt,
        health: self.health,
        ammo: self.ammo,
        fuel: self.fuel,
        weight: self.weight,
        cooldown: self.cooldown,
        collisionCount: self.collisionCount,
        collisionDamageTaken: self.collisionDamageTaken,
        enemyHitsLanded: self.enemyHitsLanded,
        enemyHitsTaken: self.enemyHitsTaken,
        lastHitDealtToId: self.lastHitDealtToId,
        lastHitTakenFromId: self.lastHitTakenFromId,
        lastHitDealtTick: self.lastHitDealtTick,
        lastHitTakenTick: self.lastHitTakenTick,
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
        deltaToMin: self.altitude - nearestWallAltitudeMin,
        deltaToMax: nearestWallAltitudeMax - self.altitude,
        belowBand: self.altitude < nearestWallAltitudeMin,
        withinBand:
          self.altitude >= nearestWallAltitudeMin && self.altitude <= nearestWallAltitudeMax,
        aboveBand: self.altitude > nearestWallAltitudeMax,
      },
      lastCollision: self.lastCollision,
      tick: state.tick,
      lastAction: result?.action ?? null,
      lastReward: result?.reward ?? 0,
    };
  }
}

const hashReplay = async (frames: ReplayFrame[]): Promise<string> => {
  const json = JSON.stringify(frames);
  const encoded = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
