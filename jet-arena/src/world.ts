import { CONFIG, IDLE_ACTION } from "./types";
import type { AgentAction, GameState, ReplayFrame, JetState } from "./types";

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) {
      this.seed += 2147483646;
    }
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export class GameWorld {
  public state: GameState;
  public replayLog: ReplayFrame[] = [];
  private rng: SeededRandom;

  constructor(playerIds: string[], seed: number) {
    this.rng = new SeededRandom(seed);
    const jets = new Map<string, JetState>();

    playerIds.forEach((id, index) => {
      const angle = (2 * Math.PI * index) / playerIds.length;
      const jitter = (this.rng.next() - 0.5) * 0.08;
      const spawnRadius = CONFIG.ARENA_RADIUS * 0.7;
      jets.set(id, {
        id,
        x: Math.cos(angle + jitter) * spawnRadius,
        y: Math.sin(angle + jitter) * spawnRadius,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        health: CONFIG.INITIAL_HEALTH,
        ammo: CONFIG.INITIAL_AMMO,
        fuel: CONFIG.INITIAL_FUEL,
        weight: CONFIG.BASE_WEIGHT,
        cooldown: 0,
        alive: true,
      });
    });

    this.state = {
      tick: 0,
      jets,
      bullets: [],
      arenaRadius: CONFIG.ARENA_RADIUS,
    };
  }

  step(actions: Map<string, AgentAction>): GameState {
    const safeActions = new Map<string, AgentAction>();
    for (const [id, jet] of this.state.jets.entries()) {
      if (!jet.alive) continue;
      safeActions.set(id, this.sanitizeAction(actions.get(id) ?? IDLE_ACTION));
    }

    this.applyJetActions(safeActions);
    this.updateBullets();
    this.state.tick += 1;
    this.replayLog.push(this.snapshotFrame());
    return this.state;
  }

  getAliveCount(): number {
    let count = 0;
    for (const jet of this.state.jets.values()) {
      if (jet.alive) {
        count += 1;
      }
    }
    return count;
  }

  getWinnerId(): string | null {
    const alive = [...this.state.jets.values()].filter((jet) => jet.alive);
    if (alive.length === 1) {
      return alive[0].id;
    }
    if (alive.length === 0) {
      return null;
    }
    if (this.state.tick >= CONFIG.MAX_TICKS) {
      return this.pickResourceTieBreaker(alive);
    }

    // Resolve hard stalemates when no one can meaningfully act anymore.
    // This prevents "frozen survivors" late-game once fuel/ammo are exhausted.
    const noBulletsInFlight = this.state.bullets.length === 0;
    const allOutOfFuel = alive.every((jet) => jet.fuel <= 0);
    const allOutOfAmmo = alive.every((jet) => jet.ammo <= 0);
    if (noBulletsInFlight && (allOutOfFuel || allOutOfAmmo)) {
      return this.pickResourceTieBreaker(alive);
    }
    return null;
  }

  private pickResourceTieBreaker(alive: JetState[]): string | null {
    alive.sort((left, right) => {
      if (right.health !== left.health) return right.health - left.health;
      if (right.fuel !== left.fuel) return right.fuel - left.fuel;
      if (right.ammo !== left.ammo) return right.ammo - left.ammo;
      return left.id.localeCompare(right.id);
    });
    return alive[0]?.id ?? null;
  }

  private sanitizeAction(action: AgentAction): AgentAction {
    return {
      thrust: Number.isFinite(action.thrust) ? clamp(action.thrust, -1, 1) : 0,
      turn: Number.isFinite(action.turn) ? clamp(action.turn, -1, 1) : 0,
      shoot: Boolean(action.shoot),
    };
  }

  private applyJetActions(actions: Map<string, AgentAction>): void {
    for (const [id, jet] of this.state.jets.entries()) {
      if (!jet.alive) continue;
      const action = actions.get(id) ?? IDLE_ACTION;

      const weightDelta = jet.weight - CONFIG.BASE_WEIGHT;
      const effectiveDrag = Math.max(0.9, CONFIG.DRAG - weightDelta * CONFIG.WEIGHT_DRAG_FACTOR);
      const effectiveTurnRate = Math.max(0.01, CONFIG.TURN_RATE - weightDelta * CONFIG.WEIGHT_TURN_PENALTY);

      jet.angle += action.turn * effectiveTurnRate;

      if (jet.fuel > 0 && action.thrust !== 0) {
        const thrust = action.thrust * CONFIG.THRUST_FORCE;
        jet.vx += Math.cos(jet.angle) * thrust;
        jet.vy += Math.sin(jet.angle) * thrust;
        jet.fuel = Math.max(0, jet.fuel - Math.abs(action.thrust) * 0.5);
      }

      jet.vx *= effectiveDrag;
      jet.vy *= effectiveDrag;

      const speed = Math.hypot(jet.vx, jet.vy);
      if (speed > CONFIG.MAX_SPEED) {
        jet.vx = (jet.vx / speed) * CONFIG.MAX_SPEED;
        jet.vy = (jet.vy / speed) * CONFIG.MAX_SPEED;
      }

      jet.x += jet.vx;
      jet.y += jet.vy;
      this.applyArenaBoundary(jet);

      if (
        action.shoot &&
        jet.cooldown <= 0 &&
        jet.ammo > 0 &&
        jet.fuel >= CONFIG.SHOOT_FUEL_COST
      ) {
        jet.ammo -= 1;
        jet.fuel -= CONFIG.SHOOT_FUEL_COST;
        jet.weight += CONFIG.SHOOT_WEIGHT_PENALTY;
        jet.cooldown = CONFIG.SHOOT_COOLDOWN;
        this.state.bullets.push({
          ownerId: id,
          x: jet.x + Math.cos(jet.angle) * 18,
          y: jet.y + Math.sin(jet.angle) * 18,
          vx: Math.cos(jet.angle) * CONFIG.BULLET_SPEED + jet.vx * 0.5,
          vy: Math.sin(jet.angle) * CONFIG.BULLET_SPEED + jet.vy * 0.5,
          ttl: CONFIG.BULLET_TTL,
        });
      }

      if (jet.cooldown > 0) {
        jet.cooldown -= 1;
      }

      if (jet.health <= 0) {
        jet.alive = false;
      }
    }
  }

  private applyArenaBoundary(jet: JetState): void {
    const distance = Math.hypot(jet.x, jet.y);
    if (distance <= CONFIG.ARENA_RADIUS) {
      return;
    }

    const normalX = jet.x / distance;
    const normalY = jet.y / distance;
    jet.x = normalX * CONFIG.ARENA_RADIUS;
    jet.y = normalY * CONFIG.ARENA_RADIUS;

    const dot = jet.vx * normalX + jet.vy * normalY;
    jet.vx -= 2 * dot * normalX;
    jet.vy -= 2 * dot * normalY;
    jet.health -= 1.25;
  }

  private updateBullets(): void {
    for (let index = this.state.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.state.bullets[index];
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
      bullet.ttl -= 1;

      const outsideArena = Math.hypot(bullet.x, bullet.y) > CONFIG.ARENA_RADIUS * 1.1;
      if (bullet.ttl <= 0 || outsideArena) {
        this.state.bullets.splice(index, 1);
        continue;
      }

      for (const [id, jet] of this.state.jets.entries()) {
        if (!jet.alive || id === bullet.ownerId) continue;
        const dx = bullet.x - jet.x;
        const dy = bullet.y - jet.y;
        if (dx * dx + dy * dy <= CONFIG.JET_HIT_RADIUS ** 2) {
          jet.health -= CONFIG.BULLET_DAMAGE;
          if (jet.health <= 0) {
            jet.alive = false;
          }
          this.state.bullets.splice(index, 1);
          break;
        }
      }
    }
  }

  private snapshotFrame(): ReplayFrame {
    const jets = [...this.state.jets.values()]
      .map((jet) => ({
        id: jet.id,
        x: jet.x,
        y: jet.y,
        vx: jet.vx,
        vy: jet.vy,
        angle: jet.angle,
        health: jet.health,
        ammo: jet.ammo,
        fuel: jet.fuel,
        weight: jet.weight,
        cooldown: jet.cooldown,
        alive: jet.alive,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const bullets = this.state.bullets.map((bullet) => ({
      ownerId: bullet.ownerId,
      x: bullet.x,
      y: bullet.y,
      vx: bullet.vx,
      vy: bullet.vy,
      ttl: bullet.ttl,
    }));

    return {
      tick: this.state.tick,
      jets,
      bullets,
    };
  }
}
