import type { RuntimeConfig } from "./config";
import type { WallContact } from "./arena";

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
  };
  enemies: EnemyObservation[];
  nearbyBullets: BulletObservation[];
  nearestWall: WallContact;
  nearbyWalls: WallContact[];
  distanceToWall: number;
  tick: number;
  lastAction: AgentAction | null;
  lastReward: number;
}

export interface AgentModule {
  init: (config: RuntimeConfig) => void;
  act: (observation: Observation) => AgentAction;
  learn: (observation: Observation, reward: number) => void;
}
