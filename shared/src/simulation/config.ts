import type { AgentAction } from "./agent";
import type { PickupConfig } from "./state";

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
  JET_COLLISION_DEATH_RADIUS_MULTIPLIER: 0.35,
  JET_COLLISION_ALTITUDE_TOLERANCE: 0.08,
  PICKUP_COLLECT_RADIUS: 20,
  PICKUP_HEALTH_AMOUNT: 25,
  PICKUP_AMMO_AMOUNT: 12,
  PICKUP_FUEL_AMOUNT: 200,
  PICKUP_CONFIG: {
    enabled: true,
    mode: "random",
    fixedCounts: { ammo: 2, fuel: 2, health: 1 },
    randomCeiling: "auto",
    respawnIntervalTicks: 90,
  } as PickupConfig,
} as const;

export type RuntimeConfig = typeof CONFIG;

export const IDLE_ACTION: AgentAction = {
  thrust: 0,
  turn: 0,
  climb: 0,
  shoot: false,
};
