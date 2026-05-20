---
name: character-description-to-jet-agent
description: Generate Jet Arena agent code from character descriptions. Use when the user asks to create or refactor an agent personality/lore into `jet-arena/agents/<agent>/agent.ts` behavior compatible with `jet-arena/src/types.ts`.
disable-model-invocation: true
---

# Agent Character To Jet

Convert a narrative character brief into a working Jet Arena agent module.

## Scope

- Target runtime: **V8 isolate sandbox** (server-side, via `isolated-vm`). NOT a browser Web Worker.
- Target contract: `jet-arena/src/types.ts` (`AgentModule`, `Observation`, `AgentAction`).
- Target file shape: `jet-arena/agents/<agent-key>/agent.ts`.

## Sandbox Environment

Agent code runs inside an `isolated-vm` V8 isolate on the server. The isolate has its own `globalThis` with **only** standard ECMAScript built-ins.

### Available

- All ES2024 built-ins: `Math`, `Date`, `JSON`, `Map`, `Set`, `Array`, `Object`, `Promise`, `Symbol`, `RegExp`, `Number`, `String`, `parseInt`, `parseFloat`, `isNaN`, `isFinite`, `Infinity`, `NaN`, `undefined`
- `globalThis` (the isolate's own global — NOT the host process global)
- Standard typed arrays: `Float64Array`, `Int32Array`, `Uint8Array`, etc.
- `CONFIG` — injected read-only object with arena/game constants (tick rate, arena radius, bullet speed, etc.)

### NOT Available — Do NOT Use

- `console` (no `console.log`, `console.warn`, etc.)
- `fetch`, `XMLHttpRequest`, `WebSocket` — no network access
- `setTimeout`, `setInterval`, `requestAnimationFrame` — no timers
- `require`, `import()` — no module loading
- `Bun`, `process`, `Buffer` — no host runtime APIs
- `self`, `window`, `document`, `navigator` — no browser/worker globals
- `tf` / TensorFlow.js — no external libraries of any kind
- `eval()` — blocked

### Timing

Use `observation.tick` (integer, increments every game tick at 30 Hz) for all timing logic. Do NOT use `Date.now()` — it works in the isolate but makes replays non-deterministic.

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
      // return fully bounded action:
      return { thrust: 0, turn: 0, climb: 0, shoot: false };
    },
  };
})();
```

## Output Expectations

- Return only the final `agent.ts` source code (no extra analysis text).
- Use concise comments only where behavior transitions are non-obvious.
- Keep behavior explainable in 4-8 tactical bullets after implementation.
- If requested, add matching sprite pose intent notes, but keep gameplay code independent.

## Quick Validation Checklist

- Returns valid `AgentAction` every tick
- Handles no-target and high-threat cases
- Uses at least one explicit state transition
- Shooting gated by cooldown + alignment + range
- Movement bounded and stable near arena walls
- Uses `observation.tick` for timing — never `Date.now()`
- No `console`, `fetch`, `require`, `import`, or any host API calls
- Purely synchronous — no `async`, no `await`, no `Promise`
