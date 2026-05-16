import { ArenaShape } from "./arena-shape";
import { CONFIG, IDLE_ACTION } from "./types";
import type { AgentAction, BattlefieldConfig, GameState, ReplayFrame, JetState, WallContact } from "./types";

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
const COLLISION_DAMAGE = 1.25;

export class GameWorld {
  public state: GameState;
  public replayLog: ReplayFrame[] = [];
  private rng: SeededRandom;
  private arenaShape: ArenaShape;
  private spawnPoints: Array<{ x: number; y: number }>;

  constructor(playerIds: string[], seed: number, battlefield: BattlefieldConfig) {
    this.rng = new SeededRandom(seed);
    this.arenaShape = new ArenaShape(battlefield);
    this.spawnPoints = battlefield.spawnPoints.map(([x, y]) => ({ x, y }));
    const jets = new Map<string, JetState>();
    const bounds = this.arenaShape.getBoundingBox();
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    playerIds.forEach((id, index) => {
      const spawn = this.pickSpawn(index, playerIds.length);
      const spawnX = spawn.x + (this.rng.next() - 0.5) * 6;
      const spawnY = spawn.y + (this.rng.next() - 0.5) * 6;
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const angle = Math.atan2(centerY - spawnY, centerX - spawnX);
      jets.set(id, {
        id,
        x: spawnX,
        y: spawnY,
        altitude: CONFIG.SPAWN_ALTITUDE,
        vx: 0,
        vy: 0,
        vAlt: 0,
        angle: angle + Math.PI,
        health: CONFIG.INITIAL_HEALTH,
        ammo: CONFIG.INITIAL_AMMO,
        fuel: CONFIG.INITIAL_FUEL,
        weight: CONFIG.BASE_WEIGHT,
        cooldown: 0,
        collisionCount: 0,
        collisionDamageTaken: 0,
        lastCollision: null,
        enemyHitsLanded: 0,
        enemyHitsTaken: 0,
        lastHitDealtToId: null,
        lastHitTakenFromId: null,
        lastHitDealtTick: null,
        lastHitTakenTick: null,
        alive: true,
      });
    });

    this.state = {
      tick: 0,
      jets,
      bullets: [],
      recentHitEvents: [],
      arenaBounds: {
        width,
        height,
      },
    };
  }

  step(actions: Map<string, AgentAction>): GameState {
    this.state.recentHitEvents = [];
    const safeActions = new Map<string, AgentAction>();
    for (const [id, jet] of this.state.jets.entries()) {
      if (!jet.alive) continue;
      safeActions.set(id, this.sanitizeAction(actions.get(id) ?? IDLE_ACTION));
    }

    this.applyJetActions(safeActions);
    this.resolveJetCollisions();
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
    let candidateWinner: string | null = null;
    if (alive.length === 1) {
      candidateWinner = alive[0]?.id ?? null;
    } else if (alive.length === 0) {
      candidateWinner = null;
    } else if (this.state.tick >= CONFIG.MAX_TICKS) {
      candidateWinner = this.pickResourceTieBreaker(alive);
    } else {
      // Resolve hard stalemates when no one can meaningfully act anymore.
      // This prevents "frozen survivors" late-game once fuel/ammo are exhausted.
      const noBulletsInFlight = this.state.bullets.length === 0;
      const allOutOfFuel = alive.every((jet) => jet.fuel <= 0);
      const allOutOfAmmo = alive.every((jet) => jet.ammo <= 0);
      if (noBulletsInFlight && (allOutOfFuel || allOutOfAmmo)) {
        candidateWinner = this.pickResourceTieBreaker(alive);
      }
    }

    if (!candidateWinner) return null;
    const winner = this.state.jets.get(candidateWinner);
    if (!winner) return null;
    return winner.enemyHitsLanded > 0 ? candidateWinner : null;
  }

  isTerminalState(): boolean {
    const alive = [...this.state.jets.values()].filter((jet) => jet.alive);
    if (alive.length <= 1) {
      return true;
    }
    if (this.state.tick >= CONFIG.MAX_TICKS) {
      return true;
    }
    const noBulletsInFlight = this.state.bullets.length === 0;
    const allOutOfFuel = alive.every((jet) => jet.fuel <= 0);
    const allOutOfAmmo = alive.every((jet) => jet.ammo <= 0);
    return noBulletsInFlight && (allOutOfFuel || allOutOfAmmo);
  }

  getNearbyWalls(x: number, y: number, altitude: number, maxDistance: number): WallContact[] {
    return this.arenaShape.getNearbyWalls(x, y, altitude, maxDistance);
  }

  getJetNearestWallDistance(jetId: string): number {
    const jet = this.state.jets.get(jetId);
    if (!jet) return Number.POSITIVE_INFINITY;
    const nearest = this.arenaShape.getNearbyWalls(
      jet.x,
      jet.y,
      jet.altitude,
      Number.POSITIVE_INFINITY,
    )[0];
    return nearest?.distance ?? Number.POSITIVE_INFINITY;
  }

  getArenaShape(): ArenaShape {
    return this.arenaShape;
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
      climb: Number.isFinite(action.climb) ? clamp(action.climb, -1, 1) : 0,
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

      if (jet.fuel > 0 && action.climb !== 0) {
        jet.vAlt += action.climb * CONFIG.CLIMB_RATE;
        jet.fuel = Math.max(0, jet.fuel - Math.abs(action.climb) * CONFIG.CLIMB_FUEL_COST);
      }
      jet.vAlt *= CONFIG.CLIMB_DRAG;
      jet.altitude = clamp(jet.altitude + jet.vAlt, CONFIG.MIN_ALTITUDE, CONFIG.MAX_ALTITUDE);
      if (jet.altitude <= CONFIG.MIN_ALTITUDE || jet.altitude >= CONFIG.MAX_ALTITUDE) {
        jet.vAlt = 0;
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
          altitude: jet.altitude,
          vx: Math.cos(jet.angle) * CONFIG.BULLET_SPEED + jet.vx * 0.5,
          vy: Math.sin(jet.angle) * CONFIG.BULLET_SPEED + jet.vy * 0.5,
          ttl: CONFIG.BULLET_TTL,
        });
      }

      if (jet.cooldown > 0) {
        jet.cooldown -= 1;
      }

      if (jet.health <= 0 || jet.fuel <= 0) {
        jet.alive = false;
      }
    }
  }

  private applyArenaBoundary(jet: JetState): void {
    const collision = this.arenaShape.resolveCollision(
      jet.x,
      jet.y,
      jet.vx,
      jet.vy,
      jet.altitude,
      CONFIG.JET_HIT_RADIUS,
    );
    if (!collision.collided) return;
    jet.x = collision.x;
    jet.y = collision.y;
    jet.vx = collision.vx;
    jet.vy = collision.vy;

    const nearestContact = collision.contacts.reduce((nearest, candidate) => {
      if (!nearest) return candidate;
      return candidate.distance < nearest.distance ? candidate : nearest;
    }, collision.contacts[0]);

    jet.collisionCount += 1;
    jet.collisionDamageTaken += COLLISION_DAMAGE;
    jet.lastCollision = {
      tick: this.state.tick,
      jetId: jet.id,
      x: nearestContact?.contactX ?? jet.x,
      y: nearestContact?.contactY ?? jet.y,
      altitude: jet.altitude,
      wallType: nearestContact?.wallType ?? "boundary",
      damage: COLLISION_DAMAGE,
    };
    jet.health -= COLLISION_DAMAGE;
  }

  private updateBullets(): void {
    for (let index = this.state.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.state.bullets[index];
      if (!bullet) continue;
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
      bullet.ttl -= 1;

      const outsideArena = this.arenaShape.isOutOfBounds(bullet.x, bullet.y, 45);
      const wallCollision = this.arenaShape.resolveCollision(
        bullet.x,
        bullet.y,
        bullet.vx,
        bullet.vy,
        bullet.altitude,
        0.5,
      ).collided;
      if (bullet.ttl <= 0 || outsideArena || wallCollision) {
        this.state.bullets.splice(index, 1);
        continue;
      }

      for (const [id, jet] of this.state.jets.entries()) {
        if (!jet.alive || id === bullet.ownerId) continue;
        const altitudeDelta = Math.abs(bullet.altitude - jet.altitude);
        if (altitudeDelta > CONFIG.ALTITUDE_HIT_TOLERANCE) continue;
        const dx = bullet.x - jet.x;
        const dy = bullet.y - jet.y;
        if (dx * dx + dy * dy <= CONFIG.JET_HIT_RADIUS ** 2) {
          jet.health -= CONFIG.BULLET_DAMAGE;
          jet.enemyHitsTaken += 1;
          jet.lastHitTakenFromId = bullet.ownerId;
          jet.lastHitTakenTick = this.state.tick;
          const attacker = this.state.jets.get(bullet.ownerId);
          if (attacker) {
            attacker.enemyHitsLanded += 1;
            attacker.lastHitDealtToId = id;
            attacker.lastHitDealtTick = this.state.tick;
          }
          this.state.recentHitEvents.push({
            tick: this.state.tick,
            attackerId: bullet.ownerId,
            targetId: id,
            damage: CONFIG.BULLET_DAMAGE,
          });
          if (jet.health <= 0) {
            jet.alive = false;
          }
          this.state.bullets.splice(index, 1);
          break;
        }
      }
    }
  }

  private resolveJetCollisions(): void {
    const aliveJets = [...this.state.jets.values()].filter((jet) => jet.alive);
    if (aliveJets.length < 2) return;

    const deathRadius =
      CONFIG.JET_HIT_RADIUS * CONFIG.JET_COLLISION_DEATH_RADIUS_MULTIPLIER;
    const deathRadiusSq = deathRadius * deathRadius;
    const fatalCollisions: Array<{
      left: JetState;
      right: JetState;
      x: number;
      y: number;
      altitude: number;
    }> = [];

    for (let i = 0; i < aliveJets.length - 1; i += 1) {
      const left = aliveJets[i]!;
      if (!left.alive) continue;

      for (let j = i + 1; j < aliveJets.length; j += 1) {
        const right = aliveJets[j]!;
        if (!right.alive) continue;

        const altitudeDelta = Math.abs(left.altitude - right.altitude);
        if (altitudeDelta > CONFIG.JET_COLLISION_ALTITUDE_TOLERANCE) continue;

        const dx = left.x - right.x;
        const dy = left.y - right.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq > deathRadiusSq) continue;

        fatalCollisions.push({
          left,
          right,
          x: (left.x + right.x) / 2,
          y: (left.y + right.y) / 2,
          altitude: (left.altitude + right.altitude) / 2,
        });
      }
    }

    for (const collision of fatalCollisions) {
      this.applyJetImpactDeath(collision.left, collision.x, collision.y, collision.altitude);
      this.applyJetImpactDeath(collision.right, collision.x, collision.y, collision.altitude);
    }
  }

  private applyJetImpactDeath(jet: JetState, x: number, y: number, altitude: number): void {
    if (!jet.alive) return;
    const impactDamage = Math.max(0, jet.health);
    jet.alive = false;
    jet.health = 0;
    jet.collisionCount += 1;
    jet.collisionDamageTaken += impactDamage;
    jet.lastCollision = {
      tick: this.state.tick,
      jetId: jet.id,
      x,
      y,
      altitude,
      wallType: "jet",
      damage: impactDamage,
    };
  }

  private snapshotFrame(): ReplayFrame {
    const jets = [...this.state.jets.values()]
      .map((jet) => ({
        id: jet.id,
        x: jet.x,
        y: jet.y,
        altitude: jet.altitude,
        vx: jet.vx,
        vy: jet.vy,
        vAlt: jet.vAlt,
        angle: jet.angle,
        health: jet.health,
        ammo: jet.ammo,
        fuel: jet.fuel,
        weight: jet.weight,
        cooldown: jet.cooldown,
        collisionCount: jet.collisionCount,
        collisionDamageTaken: jet.collisionDamageTaken,
        lastCollision: jet.lastCollision ? { ...jet.lastCollision } : null,
        enemyHitsLanded: jet.enemyHitsLanded,
        enemyHitsTaken: jet.enemyHitsTaken,
        lastHitDealtToId: jet.lastHitDealtToId,
        lastHitTakenFromId: jet.lastHitTakenFromId,
        lastHitDealtTick: jet.lastHitDealtTick,
        lastHitTakenTick: jet.lastHitTakenTick,
        alive: jet.alive,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const bullets = this.state.bullets.map((bullet) => ({
      ownerId: bullet.ownerId,
      x: bullet.x,
      y: bullet.y,
      altitude: bullet.altitude,
      vx: bullet.vx,
      vy: bullet.vy,
      ttl: bullet.ttl,
    }));

    return {
      tick: this.state.tick,
      jets,
      bullets,
      hitEvents: this.state.recentHitEvents.map((event) => ({ ...event })),
    };
  }

  private pickSpawn(index: number, totalPlayers: number): { x: number; y: number } {
    if (this.spawnPoints.length >= totalPlayers) {
      return this.spawnPoints[index]!;
    }

    const bounds = this.arenaShape.getBoundingBox();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const radius = Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.32;
    const angle = (2 * Math.PI * index) / totalPlayers;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  }
}
