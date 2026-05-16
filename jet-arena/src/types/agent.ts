import type { RuntimeConfig } from "./config";
import type { WallContact } from "./arena";
import type { CollisionEvent, PickupKind } from "./state";

export interface AgentAction {
  thrust: number;
  turn: number;
  climb: number;
  shoot: boolean;
}

export interface EnemyObservation {
  relX: number;
  relY: number;
  relAltitude: number;
  relVx: number;
  relVy: number;
  angle: number;
  distance: number;
  bearingAngle: number;
  alive: boolean;
}

export interface BulletObservation {
  relX: number;
  relY: number;
  relAltitude: number;
  relVx: number;
  relVy: number;
  isMine: boolean;
}

export interface PickupObservation {
  relX: number;
  relY: number;
  relAltitude: number;
  kind: PickupKind;
  distance: number;
}

export interface Observation {
  self: {
    vx: number;
    vy: number;
    speed: number;
    angle: number;
    altitude: number;
    vAlt: number;
    health: number;
    ammo: number;
    fuel: number;
    weight: number;
    cooldown: number;
    collisionCount: number;
    collisionDamageTaken: number;
    enemyHitsLanded: number;
    enemyHitsTaken: number;
    lastHitDealtToId: string | null;
    lastHitTakenFromId: string | null;
    lastHitDealtTick: number | null;
    lastHitTakenTick: number | null;
  };
  enemies: EnemyObservation[];
  nearbyBullets: BulletObservation[];
  nearbyPickups: PickupObservation[];
  nearestWall: WallContact;
  nearbyWalls: WallContact[];
  distanceToWall: number;
  nearestWallAltitudeBand: {
    altitudeMin: number;
    altitudeMax: number;
    deltaToMin: number;
    deltaToMax: number;
    belowBand: boolean;
    withinBand: boolean;
    aboveBand: boolean;
  };
  lastCollision: CollisionEvent | null;
  tick: number;
  lastAction: AgentAction | null;
  lastReward: number;
}

export interface AgentModule {
  init: (config: RuntimeConfig) => void;
  act: (observation: Observation) => AgentAction;
  learn: (observation: Observation, reward: number) => void;
}
