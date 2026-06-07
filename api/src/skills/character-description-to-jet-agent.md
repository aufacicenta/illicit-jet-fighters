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

## Response Format (Hard Requirement)

- Output must be raw JavaScript/TypeScript source text only.
- Do **not** wrap output in markdown fences.
- Do **not** output any prose, headings, labels, or explanations before/after code.
- First character of the response must be `g` from `globalThis.__agentExport`.
- If you are about to write a fenced block (for example: triple-backtick ts, triple-backtick typescript, or triple-backtick javascript), remove the fences and return only the inner code.

## Runtime Evaluator Semantics (Canonical)

Assume the evaluator behaves exactly like this:

1. **Compile/load phase**
   - Evaluates the generated source text dynamically.
   - Expects code to assign `globalThis.__agentExport` to an object with `init`, `act`, and `learn` functions.
   - Optionally supports `serialize()` for checkpoint export after arena matches.
   - `init(config, checkpoint)` receives `CONFIG` and an optional checkpoint JSON string from prior arena matches.
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
- `tf` — TensorFlow.js library (injected automatically when code references `tf.`; use for learning agents only)

### NOT Available — Do NOT Use

- `console` (no `console.log`, `console.warn`, etc.)
- `fetch`, `XMLHttpRequest`, `WebSocket` — no network access
- `setTimeout`, `setInterval`, `requestAnimationFrame` — no timers
- `require`, `import()` — no module loading
- `Bun`, `process`, `Buffer` — no host runtime APIs
- `window`, `document`, `navigator` — no browser globals
- Any library other than injected `tf` and built-ins listed above
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
- `init(config, checkpoint)` receives the `RuntimeConfig` object and optional checkpoint JSON string (`null` on first arena entry). Restore learned state when `checkpoint` is provided.
- Optional `serialize()` returns a JSON string of learned state for arena checkpoint persistence. Omit for pure heuristic agents.
- `act(observation)` must always return:
  - `thrust: number` in `[-1, 1]`
  - `turn: number` in `[-1, 1]`
  - `climb: number` in `[-1, 1]`
  - `shoot: boolean`
- `learn(observation, reward)` is called after each tick with the current observation and shaped reward scalar.
- All logic must be **pure synchronous JavaScript**. No async, no Promises, no callbacks.
- For TF agents: wrap tensor work in `tf.tidy()` to avoid memory leaks; keep networks small (2-3 dense layers, <= 32 units).
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

2b. **Choose learning mode from temperament**

- **Adaptive / patient / evolving / memory-driven** characters → DQN-style TF agent with replay buffer and `serialize()` checkpoint support.
- **Instinctive / twitchy / reactive** characters → lightweight online learner (linear policy or small TF head) with `serialize()`.
- **Dogmatic / ritualistic / mechanical** characters → heuristic finite-state agent (no `tf`, no `serialize()`).

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

## Preferred Agent Skeleton (Heuristic)

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

## DQN Skeleton (Adaptive Characters)

Use when lore emphasizes growth, patience, or learning from mistakes. Must include `serialize()` for arena checkpoint carry-over.

```ts
globalThis.__agentExport = (() => {
  let model;
  let optimizer;
  const replayBuffer = [];
  const ACTIONS = [
    { thrust: 1, turn: 0, climb: 0, shoot: false },
    { thrust: 0, turn: -1, climb: 0, shoot: false },
    { thrust: 0, turn: 1, climb: 0, shoot: false },
    { thrust: 1, turn: 0, climb: 0, shoot: true },
  ];
  const MAX_REPLAY = 400;
  const BATCH_SIZE = 16;
  const GAMMA = 0.95;
  let epsilon = 0.3;
  let previousState = null;
  let previousAction = 0;

  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const vectorize = (observation) => {
    const enemy = observation.enemies
      .filter((e) => e.alive)
      .sort((a, b) => a.distance - b.distance)[0];
    return [
      observation.self.speed / (CONFIG.MAX_SPEED || 7.5),
      observation.self.health / (CONFIG.INITIAL_HEALTH || 100),
      observation.self.fuel / (CONFIG.INITIAL_FUEL || 1000),
      observation.distanceToWall / (CONFIG.ARENA_RADIUS || 420),
      enemy ? enemy.distance / (CONFIG.SENSOR_RANGE || 300) : 1,
      enemy ? clamp(enemy.bearingAngle / Math.PI) : 0,
    ];
  };

  const createModel = () => {
    model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [6], units: 24, activation: "relu" }),
        tf.layers.dense({ units: 24, activation: "relu" }),
        tf.layers.dense({ units: ACTIONS.length, activation: "linear" }),
      ],
    });
    optimizer = tf.train.adam(0.001);
  };

  const train = () => {
    if (replayBuffer.length < BATCH_SIZE * 2) return;
    tf.tidy(() => {
      const batch = [];
      for (let i = 0; i < BATCH_SIZE; i += 1) {
        batch.push(replayBuffer[Math.floor(Math.random() * replayBuffer.length)]);
      }
      const states = tf.tensor2d(batch.map((item) => item.state));
      const nextStates = tf.tensor2d(batch.map((item) => item.nextState));
      const currentQ = model.predict(states);
      const nextQ = model.predict(nextStates);
      const nextBest = nextQ.max(1);
      const targetData = currentQ.arraySync();
      const nextBestData = nextBest.arraySync();
      for (let i = 0; i < batch.length; i += 1) {
        targetData[i][batch[i].action] = batch[i].reward + GAMMA * nextBestData[i];
      }
      const targets = tf.tensor2d(targetData);
      optimizer.minimize(() => model.predict(states).sub(targets).square().mean());
    });
  };

  return {
    init(config, checkpoint) {
      createModel();
      if (checkpoint) {
        const parsed = JSON.parse(checkpoint);
        model.setWeights(parsed.weights.map((w) => tf.tensor(w.data, w.shape)));
        epsilon = parsed.epsilon ?? 0.1;
      }
    },
    serialize() {
      const weights = model.getWeights().map((w) => ({
        data: Array.from(w.dataSync()),
        shape: w.shape,
      }));
      return JSON.stringify({ weights, epsilon });
    },
    learn(observation, reward) {
      if (!previousState || previousAction < 0) return;
      replayBuffer.push({
        state: previousState,
        action: previousAction,
        reward,
        nextState: vectorize(observation),
      });
      if (replayBuffer.length > MAX_REPLAY) replayBuffer.shift();
      train();
    },
    act(observation) {
      const state = vectorize(observation);
      let actionIndex = 0;
      if (Math.random() < epsilon) {
        actionIndex = Math.floor(Math.random() * ACTIONS.length);
      } else {
        const qValues = tf.tidy(() => model.predict(tf.tensor2d([state])));
        actionIndex = Number(qValues.argMax(1).dataSync()[0]);
        qValues.dispose();
      }
      epsilon = Math.max(0.07, epsilon * 0.9995);
      previousState = state;
      previousAction = actionIndex;
      return ACTIONS[actionIndex];
    },
  };
})();
```

## Lightweight Learner Skeleton (Instinctive Characters)

Use for reactive/twitchy personalities. Small learnable weights, no replay buffer.

```ts
globalThis.__agentExport = (() => {
  const ACTION_COUNT = 4;
  let weights = null;

  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const randomInit = () =>
    Array.from({ length: ACTION_COUNT * 8 }, () => (Math.random() - 0.5) * 0.2);
  const features = (observation) => {
    const enemy = observation.enemies
      .filter((e) => e.alive)
      .sort((a, b) => a.distance - b.distance)[0];
    return [
      observation.self.speed / (CONFIG.MAX_SPEED || 7.5),
      observation.self.health / (CONFIG.INITIAL_HEALTH || 100),
      observation.distanceToWall / (CONFIG.ARENA_RADIUS || 420),
      enemy ? enemy.distance / (CONFIG.SENSOR_RANGE || 300) : 1,
      enemy ? clamp(enemy.bearingAngle / Math.PI) : 0,
      observation.self.ammo / (CONFIG.INITIAL_AMMO || 50),
      observation.self.fuel / (CONFIG.INITIAL_FUEL || 1000),
      observation.self.cooldown <= 0 ? 1 : 0,
    ];
  };

  return {
    init(config, checkpoint) {
      weights = checkpoint ? JSON.parse(checkpoint) : randomInit();
    },
    serialize() {
      return JSON.stringify(weights);
    },
    learn(observation, reward) {
      const x = features(observation);
      const lr = 0.01;
      for (let i = 0; i < weights.length; i += 1) {
        weights[i] += lr * reward * x[i % x.length];
      }
    },
    act(observation) {
      const x = features(observation);
      let best = 0;
      let bestScore = -Infinity;
      for (let a = 0; a < ACTION_COUNT; a += 1) {
        let score = 0;
        for (let i = 0; i < x.length; i += 1) {
          score += weights[a * x.length + i] * x[i];
        }
        if (score > bestScore) {
          bestScore = score;
          best = a;
        }
      }
      const presets = [
        { thrust: 1, turn: 0, climb: 0, shoot: false },
        { thrust: 0, turn: -1, climb: 0, shoot: false },
        { thrust: 0, turn: 1, climb: 0, shoot: false },
        { thrust: 0.8, turn: 0, climb: 0, shoot: true },
      ];
      return presets[best];
    },
  };
})();
```

## Output Expectations

- Return only the final `agent.ts` source code as **plain text**.
- Forbidden wrappers: triple-backtick ts, triple-backtick typescript, triple-backtick javascript, and bare triple-backticks.
- Forbidden extras: `Here is the code`, `agent.ts`, `Output:`, headings, or trailing explanations.
- Start exactly with `globalThis.__agentExport = (() => {`.
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
- Learning agents implement `serialize()` returning valid JSON; `init(config, checkpoint)` handles `checkpoint = null`
- TF inference/training wrapped in `tf.tidy()` where applicable
