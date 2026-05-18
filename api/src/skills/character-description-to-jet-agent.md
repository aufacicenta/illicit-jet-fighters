---
name: character-description-to-jet-agent
description: Generate Jet Arena agent code from character descriptions. Use when the user asks to create or refactor an agent personality/lore into `jet-arena/agents/<agent>/agent.ts` behavior compatible with `jet-arena/src/types.ts`.
disable-model-invocation: true
---

# Agent Character To Jet

Convert a narrative character brief into a working Jet Arena agent module.

## Scope

- Target runtime: `jet-arena` agent worker.
- Target contract: `jet-arena/src/types.ts` (`AgentModule`, `Observation`, `AgentAction`).
- Target file shape: `jet-arena/agents/<agent-key>/agent.ts`.

## Hard Requirements

- Export with:
  - `globalThis.__agentExport = (() => ({ init(){}, act(){}, learn(){} }))();`
- `act(observation)` must always return:
  - `thrust: number` in `[-1, 1]`
  - `turn: number` in `[-1, 1]`
  - `climb: number` in `[-1, 1]`
  - `shoot: boolean`
- Keep logic pure JS/TS-compatible in worker context.
- No external network, filesystem, or DOM assumptions.

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

  return {
    init() {},
    learn() {},
    act(observation) {
      const { self, enemies, nearbyBullets, distanceToWall } = observation;
      const liveEnemies = enemies.filter((e) => e.alive);

      // state selection + decision logic
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
