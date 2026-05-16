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
  arenaRadius: number;
}

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
  distanceToWall: number;
  tick: number;
  lastAction: AgentAction | null;
  lastReward: number;
}

export interface AgentModule {
  init: (config: typeof CONFIG) => void;
  act: (observation: Observation) => AgentAction;
  learn: (observation: Observation, reward: number) => void;
}

export type ReplayJet = Omit<JetState, "alive"> & { alive: boolean };

export interface ReplayFrame {
  tick: number;
  jets: ReplayJet[];
  bullets: BulletState[];
}

export const CONFIG = {
  TICK_RATE: 30,
  ACTION_TIMEOUT_MS: 80,
  MAX_TICKS: 30 * 60 * 3,
  ARENA_RADIUS: 420,
  JET_HIT_RADIUS: 16,
  MAX_SPEED: 7.5,
  THRUST_FORCE: 0.16,
  TURN_RATE: 0.07,
  DRAG: 0.985,
  INITIAL_AMMO: 50,
  INITIAL_FUEL: 1000,
  INITIAL_HEALTH: 100,
  SHOOT_COOLDOWN: 5,
  SHOOT_FUEL_COST: 3,
  SHOOT_WEIGHT_PENALTY: 0.02,
  BULLET_SPEED: 11,
  BULLET_TTL: 60,
  BULLET_DAMAGE: 15,
  BASE_WEIGHT: 1.0,
  WEIGHT_DRAG_FACTOR: 0.005,
  WEIGHT_TURN_PENALTY: 0.008,
  SENSOR_RANGE: 300,
  MIN_ALTITUDE: 0,
  MAX_ALTITUDE: 1,
  SPAWN_ALTITUDE: 0.5,
  CLIMB_RATE: 0.025,
  CLIMB_DRAG: 0.9,
  CLIMB_FUEL_COST: 0.08,
  ALTITUDE_HIT_TOLERANCE: 0.18,
} as const;

export const IDLE_ACTION: AgentAction = {
  thrust: 0,
  turn: 0,
  climb: 0,
  shoot: false,
};
