---
name: character-description-to-jet-agent
description: Generate Jet Arena agent code from character descriptions. Use when the user asks to create or refactor an agent personality/lore into a contract-compliant fighter agent module.
disable-model-invocation: true
---

# Agent Character To Jet

Convert a narrative character brief into a working Jet Arena agent module that strictly matches the current simulator contract.

## Scope

- Target runtime: **simulation agent evaluator** that compiles plain source and runs `init/learn/act` every tick.
- Assume the model may not have repository file access. Treat the embedded contract below as canonical.

## Runtime Evaluator Semantics (Canonical)

Assume the evaluator behaves exactly like this:

1. **Compile/load phase**
   - Evaluates the generated source text dynamically.
   - Expects code to assign `globalThis.__agentExport` to an object with `init`, `act`, and `learn` functions.
   - If export is missing or shape is invalid, the agent is marked failed and does not produce active actions.

2. **Per-tick phase**
   - Calls `learn(observation, reward)` first, then `act(observation)`.
   - If either call throws, that tick falls back to idle action.

3. **Action sanitization**
   - Returned action is sanitized:
     - `thrust`, `turn`, `climb`: non-finite values become `0`, then clamped to `[-1, 1]`.
     - `shoot`: coerced to boolean.
   - If computation yields `NaN`/`Infinity`, effective movement becomes neutralized.

4. **Fallback behavior**
   - If agent load fails, evaluator is not ready, or action execution fails, simulator uses idle action:
     - `{ thrust: 0, turn: 0, climb: 0, shoot: false }`

Implication: generated code must be exception-safe and finite on every tick, or the jet will appear "not moving" even while frames continue broadcasting.

## Embedded Canonical Contract (Use This, Not Memory)

The following is the exact schema to code against. Do not invent or rename fields.

```ts
type AgentAction = {
  thrust: number;
  turn: number;
  climb: number;
  shoot: boolean;
};

type EnemyObservation = {
  relX: number;
  relY: number;
  relAltitude: number;
  relVx: number;
  relVy: number;
  angle: number;
  distance: number;
  bearingAngle: number;
  alive: boolean;
};

type BulletObservation = {
  relX: number;
  relY: number;
  relAltitude: number;
  relVx: number;
  relVy: number;
  isMine: boolean;
};

type PickupObservation = {
  relX: number;
  relY: number;
  relAltitude: number;
  kind: "ammo" | "fuel" | "health";
  distance: number;
};

type Observation = {
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
  nearestWall: {
    distance: number;
    normalX: number;
    normalY: number;
    contactX: number;
    contactY: number;
    wallType: "boundary" | "obstacle";
    altitudeMin?: number;
    altitudeMax?: number;
  };
  nearbyWalls: Array<{
    distance: number;
    normalX: number;
    normalY: number;
    contactX: number;
    contactY: number;
    wallType: "boundary" | "obstacle";
    altitudeMin?: number;
    altitudeMax?: number;
  }>;
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
  lastCollision: {
    tick: number;
    withId: string;
    type: "jet" | "wall";
    impactSpeed: number;
    impactDamage: number;
  } | null;
  tick: number;
  lastAction: AgentAction | null;
  lastReward: number;
};
```

## Sandbox Environment

Agent code runs inside a dedicated worker sandbox. Code is compiled from plain source text and must assign `globalThis.__agentExport`.

### Available

- Standard JavaScript built-ins (`Math`, `Date`, `JSON`, `Map`, `Set`, `Array`, `Object`, `Number`, `String`, etc.)
- `globalThis`
- Standard typed arrays: `Float64Array`, `Int32Array`, `Uint8Array`, etc.
- `CONFIG` — injected read-only object with arena/game constants (tick rate, arena radius, bullet speed, etc.)

### NOT Available — Do NOT Use

- `console` (no `console.log`, `console.warn`, etc.)
- `fetch`, `XMLHttpRequest`, `WebSocket` — no network access
- `setTimeout`, `setInterval`, `requestAnimationFrame` — no timers
- `require`, `import()` — no module loading
- `Bun`, `process`, `Buffer` — no host runtime APIs
- `window`, `document`, `navigator` — no browser globals
- `tf` / TensorFlow.js — no external libraries of any kind
- `eval()` and dynamic code generation

### Timing

Use `observation.tick` (integer, increments every game tick at 30 Hz) for all timing logic. Do NOT use `Date.now()` — it works in the isolate but makes replays non-deterministic.

## Contract-Exact Field Map (Must Follow)

Use only these observation fields:

- `observation.self`: `vx`, `vy`, `speed`, `angle`, `altitude`, `vAlt`, `health`, `ammo`, `fuel`, `weight`, `cooldown`, combat/collision counters, and hit metadata fields.
- `observation.enemies[]`: `relX`, `relY`, `relAltitude`, `relVx`, `relVy`, `angle`, `distance`, `bearingAngle`, `alive`.
- `observation.nearbyBullets[]`: `relX`, `relY`, `relAltitude`, `relVx`, `relVy`, `isMine`.
- `observation.nearbyPickups[]`: `relX`, `relY`, `relAltitude`, `kind`, `distance`.
- `observation.nearestWall`, `observation.nearbyWalls`, `observation.distanceToWall`, `observation.nearestWallAltitudeBand`.
- `observation.lastCollision`, `observation.lastAction`, `observation.lastReward`, `observation.tick`.

Do NOT use non-existent fields such as:

- `self.x`, `self.y`, `self.z`
- `enemy.x`, `enemy.y`, `enemy.vx`, `enemy.vy`, `enemy.id`
- `bullet.x`, `bullet.y`, `bullet.vx`, `bullet.vy`
- `observation.time`, `self.canShoot`

If a concept needs absolute position, derive behavior from relative vectors (`relX`, `relY`, `distance`, `bearingAngle`) instead.

## Value Scale Guide (Must Follow)

- `self.health` is absolute, typically `0..100` (`CONFIG.INITIAL_HEALTH`).
- `self.fuel` is absolute, typically `0..1000` (`CONFIG.INITIAL_FUEL`).
- `self.ammo` is absolute count, typically starts near `50` (`CONFIG.INITIAL_AMMO`).
- `self.altitude` is normalized `0..1`; `self.vAlt` is altitude velocity.
- `tick` increments by 1 each frame at `CONFIG.TICK_RATE` (30 Hz).
- `self.cooldown <= 0` means shooting is available.
- `distance`/`distanceToWall` are world-space distances (same XY space as arena radius).

When thresholding health/fuel, either:

- use absolute thresholds (for example `health < 30`, `fuel < 150`), or
- normalize intentionally (`health / CONFIG.INITIAL_HEALTH`, `fuel / CONFIG.INITIAL_FUEL`).

## Hard Requirements

- Export with:
  - `globalThis.__agentExport = (() => ({ init(){}, act(){}, learn(){} }))();`
- `init(config)` receives the `RuntimeConfig` object. Use it or ignore it.
- `act(observation)` must always return:
  - `thrust: number` in `[-1, 1]`
  - `turn: number` in `[-1, 1]`
  - `climb: number` in `[-1, 1]`
  - `shoot: boolean`
- `learn(observation, reward)` is called after each tick with the current observation and shaped reward scalar.
- All logic must be **pure synchronous JavaScript**. No async, no Promises, no callbacks.
- No external dependencies. Everything must be self-contained.
- Return finite movement every tick; never return `NaN`/`Infinity`.
- Always keep non-zero movement intent in at least one normal state (`thrust` and/or `turn`) so the agent does not stall.

## Mapping Workflow

1. **Extract identity anchors**
   - Combat temperament (aggressive, evasive, patient, trickster)
   - Signature motif (mask, relic, ritual, machine, doctrine)
   - Vulnerability trigger (low health, low fuel, crowded fights, wall pressure)

2. **Map anchors to mechanics**
   - Threat response: bullet dodge, wall avoidance, altitude control
   - Targeting model: nearest enemy, multi-target scoring, predictive lead
   - Fire doctrine: confidence threshold + alignment/range/cooldown checks
   - Resource doctrine: ammo/fuel conservation and late-game behavior

3. **Define finite behavior states**
   - Typical states: default, advantage, pressured, critical
   - State transition drivers: `health`, `fuel`, bullet pressure, enemy count
   - Each state should have distinct `thrust/turn/climb/shoot` posture

4. **Implement robust helpers**
   - `clamp(value)` for `[-1, 1]`
   - normalized angle helpers (`atan2(sin, cos)`)
   - deterministic target scoring and fallback behavior

5. **Guarantee safe fallback**
   - If no enemies: controlled idle/patrol behavior
   - If overwhelmed: prioritize survival over shooting
   - If any intermediate math is non-finite, fall back to deterministic bounded defaults

## Preferred Agent Skeleton

```ts
globalThis.__agentExport = (() => {
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const normAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  let lastShotTick = 0;

  return {
    init() {},
    learn() {},
    act(observation) {
      const { self, enemies, nearbyBullets, distanceToWall, tick } = observation;
      const liveEnemies = enemies.filter((e) => e.alive);

      // state selection + decision logic
      // use tick for cooldown timing: if (tick - lastShotTick > COOLDOWN) { ... }
      // use self.cooldown <= 0 to gate shooting when needed
      // return fully bounded action:
      return { thrust: 0, turn: 0, climb: 0, shoot: false };
    },
  };
})();
```

## Output Expectations

- Return only the final `agent.ts` source code (no markdown fences, no prose before/after).
- Use concise comments only where behavior transitions are non-obvious.
- If asked for explanation, provide it separately from the code output.

## Quick Validation Checklist

- Returns valid `AgentAction` every tick
- Uses only contract fields from `Observation` (no guessed aliases)
- Handles no-target and high-threat cases
- Uses at least one explicit state transition
- Shooting gated by cooldown (`self.cooldown` and/or tick policy) + alignment + range
- Movement bounded and stable near arena walls
- Uses `observation.tick` for timing — never `Date.now()`
- No `console`, `fetch`, `require`, `import`, or any host API calls
- Purely synchronous — no `async`, no `await`, no `Promise`
