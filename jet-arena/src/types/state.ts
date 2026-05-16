import type { WallContact } from "./arena";

export interface CollisionEvent {
  tick: number;
  jetId: string;
  x: number;
  y: number;
  altitude: number;
  wallType: WallContact["wallType"];
  damage: number;
}

export interface HitEvent {
  tick: number;
  attackerId: string;
  targetId: string;
  damage: number;
}

export interface JetState {
  id: string;
  x: number;
  y: number;
  altitude: number;
  vx: number;
  vy: number;
  vAlt: number;
  angle: number;
  health: number;
  ammo: number;
  fuel: number;
  weight: number;
  cooldown: number;
  collisionCount: number;
  collisionDamageTaken: number;
  lastCollision: CollisionEvent | null;
  enemyHitsLanded: number;
  enemyHitsTaken: number;
  lastHitDealtToId: string | null;
  lastHitTakenFromId: string | null;
  lastHitDealtTick: number | null;
  lastHitTakenTick: number | null;
  alive: boolean;
}

export interface BulletState {
  ownerId: string;
  x: number;
  y: number;
  altitude: number;
  vx: number;
  vy: number;
  ttl: number;
}

export interface GameState {
  tick: number;
  jets: Map<string, JetState>;
  bullets: BulletState[];
  recentHitEvents: HitEvent[];
  arenaBounds: { width: number; height: number };
}
