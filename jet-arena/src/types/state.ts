import type { WallContact } from "./arena";

export interface CollisionEvent {
  tick: number;
  jetId: string;
  x: number;
  y: number;
  altitude: number;
  wallType: WallContact["wallType"] | "jet";
  damage: number;
}

export interface HitEvent {
  tick: number;
  attackerId: string;
  targetId: string;
  damage: number;
}

export type PickupKind = "ammo" | "fuel" | "health";

export type PickupTally = Record<PickupKind, number>;

export interface PickupState {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  altitude: number;
}

export interface PickupConfig {
  enabled: boolean;
  mode: "fixed" | "random";
  fixedCounts: PickupTally;
  randomCeiling: number | "auto";
  respawnIntervalTicks: number;
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
  pickupsCollected: PickupTally;
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
  pickups: PickupState[];
  pickupStats: {
    totalSpawned: PickupTally;
    totalCollected: PickupTally;
  };
  arenaBounds: { width: number; height: number };
}
