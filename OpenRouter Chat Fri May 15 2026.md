# Is there a machine learning library for

**User - --**

Is there a machine learning library for frontend clients/web-browsers. So imagine this game:

several players enter a battlefield, each one represents a fighter jet that shoots to other players. Players are machines, the computer itself, with tools programmed to it in the browser before the game begins. Each fighter jet tool is a learning algorithm that will reinforce itself in order to actually hit and take other jets down. 

It must learn how to aim, how to shoot, how to dock.
Shooting takes bullets and decreases one of the jet parameters, making it slower, heavier, laggy. This is a counterincentive to just shoot infinite bullets and "hope to hit".

We need this to be completely offline while the game is ongoing, meaning that the browser scripts cannot make any HTTP requests. So the actual game is how each owner of the fighter jet, programmed the learning algorithm in order to win.

This is a multiplayer game, so owners can register with some token economics. The winner takes, all, etc.

**Assistant - --**

# Browser-Based ML Fighter Jet Arena

This is a fantastic concept — essentially a **programmable AI battle royale** where the competition happens *before* the game starts (in the algorithm design), and the execution is fully offline in the browser.

## ML Libraries That Run Entirely in the Browser

| Library | Focus | Size | Best For |
|---|---|---|---|
| **TensorFlow.js** | Full ML framework | ~1MB+ | Deep RL, neural nets |
| **ONNX Runtime Web** | Model inference | ~500KB | Pre-trained models |
| **Brain.js** | Simple neural nets | ~50KB | Lightweight NN |
| **ml5.js** | Friendly TF.js wrapper | ~200KB | Quick prototyping |
| **WebPPO / custom** | RL from scratch | Tiny | Full control |
| **Synaptic.js** | Architecture-free NNs | ~30KB | Custom topologies |

**My recommendation: TensorFlow.js** for the RL backbone, but with a **custom lightweight RL loop** since you need real-time performance in a game tick.

---

## Full Architecture

```
┌─────────────────────────────────────────────────────┐
│                  GAME LOBBY (Online)                 │
│  - Wallet connect (token stake)                     │
│  - Upload/register AI agent code (IPFS or on-chain) │
│  - Match pairing                                    │
└──────────────┬──────────────────────────────────────┘
               │  Game starts → ALL network disabled
               ▼
┌─────────────────────────────────────────────────────┐
│            BROWSER SANDBOX (Offline)                 │
│                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ Agent 1 │  │ Agent 2 │  │ Agent 3 │  ...       │
│  │ (Web    │  │ (Web    │  │ (Web    │            │
│  │ Worker) │  │ Worker) │  │ Worker) │            │
│  └────┬────┘  └────┬────┘  └────┬────┘            │
│       │            │            │                   │
│       ▼            ▼            ▼                   │
│  ┌─────────────────────────────────────┐           │
│  │         GAME ENGINE (Main Thread)    │           │
│  │  - Physics (2D/3D)                  │           │
│  │  - Collision detection              │           │
│  │  - State broadcast to agents        │           │
│  │  - Action resolution                │           │
│  │  - Replay recording                 │           │
│  └─────────────────────────────────────┘           │
│                                                     │
│  Network Policy: ServiceWorker intercepts &         │
│  BLOCKS all fetch/XHR/WebSocket                     │
└──────────────┬──────────────────────────────────────┘
               │  Game ends → network restored
               ▼
┌─────────────────────────────────────────────────────┐
│             RESULTS & SETTLEMENT (Online)            │
│  - Upload replay hash on-chain                      │
│  - Smart contract distributes pot                   │
│  - Leaderboard update                               │
└─────────────────────────────────────────────────────┘
```

---

## Core Implementation

### 1. Game World & Physics Engine

```typescript
// world.ts — Deterministic game simulation
interface JetState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;        // radians, heading direction
  angularVel: number;
  health: number;       // 0–100
  ammo: number;         // finite resource
  fuel: number;         // finite resource
  weight: number;       // increases as ammo is spent (debris/heat penalty)
  cooldown: number;     // ticks until next shot allowed
  alive: boolean;
}

interface Bullet {
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;          // time-to-live in ticks
}

interface GameState {
  tick: number;
  jets: Map<string, JetState>;
  bullets: Bullet[];
  arenaRadius: number;
}

// Actions an agent can take each tick
interface AgentAction {
  thrust: number;       // -1 to 1 (brake to full thrust)
  turn: number;         // -1 to 1 (left to right)
  shoot: boolean;       // fire a bullet
}

const CONFIG = {
  TICK_RATE: 30,            // ticks per second
  MAX_TICKS: 30 * 60 * 5,  // 5-minute max game
  ARENA_RADIUS: 1000,
  
  // Jet physics
  MAX_SPEED: 8,
  THRUST_FORCE: 0.15,
  TURN_RATE: 0.06,          // radians per tick at turn=1
  DRAG: 0.98,
  
  // Resources
  INITIAL_AMMO: 50,
  INITIAL_FUEL: 1000,
  INITIAL_HEALTH: 100,
  
  // Shooting costs & penalties
  SHOOT_COOLDOWN: 5,        // ticks between shots
  SHOOT_FUEL_COST: 3,
  SHOOT_WEIGHT_PENALTY: 0.02,  // each shot makes jet heavier
  BULLET_SPEED: 12,
  BULLET_TTL: 60,           // ticks before bullet despawns
  BULLET_DAMAGE: 15,
  
  // Weight effects
  BASE_WEIGHT: 1.0,
  WEIGHT_DRAG_FACTOR: 0.005,   // extra drag per weight unit
  WEIGHT_TURN_PENALTY: 0.008,  // reduced turn rate per weight unit
} as const;

class GameWorld {
  state: GameState;
  replayLog: Array<GameState> = [];
  private rng: SeededRandom;

  constructor(playerIds: string[], seed: number) {
    this.rng = new SeededRandom(seed);
    const jets = new Map<string, JetState>();
    
    // Spawn jets in a circle
    playerIds.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / playerIds.length;
      const spawnR = CONFIG.ARENA_RADIUS * 0.7;
      jets.set(id, {
        id,
        x: Math.cos(angle) * spawnR,
        y: Math.sin(angle) * spawnR,
        vx: 0, vy: 0,
        angle: angle + Math.PI, // face center
        angularVel: 0,
        health: CONFIG.INITIAL_HEALTH,
        ammo: CONFIG.INITIAL_AMMO,
        fuel: CONFIG.INITIAL_FUEL,
        weight: CONFIG.BASE_WEIGHT,
        cooldown: 0,
        alive: true,
      });
    });

    this.state = {
      tick: 0,
      jets,
      bullets: [],
      arenaRadius: CONFIG.ARENA_RADIUS,
    };
  }

  /**
   * Advance one tick. actions = Map<playerId, AgentAction>
   * Fully deterministic — no randomness after seed.
   */
  step(actions: Map<string, AgentAction>): GameState {
    const { jets, bullets } = this.state;

    // 1. Apply actions to each alive jet
    for (const [id, jet] of jets) {
      if (!jet.alive) continue;
      const action = actions.get(id) ?? { thrust: 0, turn: 0, shoot: false };

      // Weight-adjusted parameters
      const effectiveDrag = CONFIG.DRAG - (jet.weight - CONFIG.BASE_WEIGHT) * CONFIG.WEIGHT_DRAG_FACTOR;
      const effectiveTurnRate = CONFIG.TURN_RATE - (jet.weight - CONFIG.BASE_WEIGHT) * CONFIG.WEIGHT_TURN_PENALTY;

      // Turn
      const clampedTurn = Math.max(-1, Math.min(1, action.turn));
      jet.angle += clampedTurn * Math.max(effectiveTurnRate, 0.01);

      // Thrust (costs fuel)
      const clampedThrust = Math.max(-1, Math.min(1, action.thrust));
      if (jet.fuel > 0 && clampedThrust !== 0) {
        const force = clampedThrust * CONFIG.THRUST_FORCE;
        jet.vx += Math.cos(jet.angle) * force;
        jet.vy += Math.sin(jet.angle) * force;
        jet.fuel -= Math.abs(clampedThrust) * 0.5;
      }

      // Drag
      jet.vx *= Math.max(effectiveDrag, 0.9);
      jet.vy *= Math.max(effectiveDrag, 0.9);

      // Speed cap
      const speed = Math.sqrt(jet.vx ** 2 + jet.vy ** 2);
      if (speed > CONFIG.MAX_SPEED) {
        jet.vx = (jet.vx / speed) * CONFIG.MAX_SPEED;
        jet.vy = (jet.vy / speed) * CONFIG.MAX_SPEED;
      }

      // Move
      jet.x += jet.vx;
      jet.y += jet.vy;

      // Arena boundary (bounce off walls)
      const dist = Math.sqrt(jet.x ** 2 + jet.y ** 2);
      if (dist > CONFIG.ARENA_RADIUS) {
        const norm = { x: jet.x / dist, y: jet.y / dist };
        jet.x = norm.x * CONFIG.ARENA_RADIUS;
        jet.y = norm.y * CONFIG.ARENA_RADIUS;
        // Reflect velocity
        const dot = jet.vx * norm.x + jet.vy * norm.y;
        jet.vx -= 2 * dot * norm.x;
        jet.vy -= 2 * dot * norm.y;
        jet.health -= 2; // wall damage
      }

      // Shoot
      if (action.shoot && jet.cooldown <= 0 && jet.ammo > 0 && jet.fuel >= CONFIG.SHOOT_FUEL_COST) {
        jet.ammo--;
        jet.fuel -= CONFIG.SHOOT_FUEL_COST;
        jet.weight += CONFIG.SHOOT_WEIGHT_PENALTY;
        jet.cooldown = CONFIG.SHOOT_COOLDOWN;

        bullets.push({
          ownerId: id,
          x: jet.x + Math.cos(jet.angle) * 15,
          y: jet.y + Math.sin(jet.angle) * 15,
          vx: Math.cos(jet.angle) * CONFIG.BULLET_SPEED + jet.vx * 0.5,
          vy: Math.sin(jet.angle) * CONFIG.BULLET_SPEED + jet.vy * 0.5,
          ttl: CONFIG.BULLET_TTL,
        });
      }

      if (jet.cooldown > 0) jet.cooldown--;
    }

    // 2. Update bullets & check collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.ttl--;

      if (b.ttl <= 0 || Math.sqrt(b.x ** 2 + b.y ** 2) > CONFIG.ARENA_RADIUS * 1.1) {
        bullets.splice(i, 1);
        continue;
      }

      // Hit detection against jets
      for (const [id, jet] of jets) {
        if (!jet.alive || id === b.ownerId) continue;
        const dx = b.x - jet.x;
        const dy = b.y - jet.y;
        if (dx * dx + dy * dy < 20 * 20) { // 20px hit radius
          jet.health -= CONFIG.BULLET_DAMAGE;
          if (jet.health <= 0) {
            jet.alive = false;
          }
          bullets.splice(i, 1);
          break;
        }
      }
    }

    this.state.tick++;
    
    // Record for replay
    this.replayLog.push(structuredClone(this.state));
    
    return this.state;
  }

  getAliveCount(): number {
    let count = 0;
    for (const jet of this.state.jets.values()) {
      if (jet.alive) count++;
    }
    return count;
  }

  getWinner(): string | null {
    const alive = [...this.state.jets.values()].filter(j => j.alive);
    if (alive.length === 1) return alive[0].id;
    if (alive.length === 0) return null; // draw
    if (this.state.tick >= CONFIG.MAX_TICKS) {
      // Most health wins
      alive.sort((a, b) => b.health - a.health);
      return alive[0].id;
    }
    return null; // game still ongoing
  }
}

// Deterministic PRNG for fair seeded games
class SeededRandom {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}
```

### 2. Agent Interface & Sandboxed Execution

```typescript
// agent-interface.ts — What players implement

/**
 * OBSERVATION: what each agent sees every tick.
 * Positions are relative to the agent's jet (ego-centric).
 */
interface Observation {
  // Self state
  self: {
    vx: number; vy: number;
    speed: number;
    angle: number;
    health: number;
    ammo: number;
    fuel: number;
    weight: number;
    cooldown: number;
  };
  
  // Other jets (relative positions/velocities)
  enemies: Array<{
    relX: number;      // relative x from self
    relY: number;      // relative y from self
    relVx: number;     // relative velocity
    relVy: number;
    angle: number;     // their heading
    distance: number;
    bearingAngle: number; // angle from self heading to enemy
    alive: boolean;
  }>;
  
  // Incoming bullets (only those within sensor range)
  nearbyBullets: Array<{
    relX: number;
    relY: number;
    relVx: number;
    relVy: number;
    isMine: boolean;
  }>;
  
  // Arena info
  distanceToWall: number;
  tick: number;
  
  // Previous action result
  lastAction: AgentAction | null;
  lastReward: number;
}

/**
 * This is the interface each player must implement.
 * The code runs inside a Web Worker with NO network access.
 */
interface AgentModule {
  /**
   * Called once at game start. Use for initializing your model,
   * loading pre-trained weights from the bundled code, etc.
   */
  init(config: typeof CONFIG): void;
  
  /**
   * Called every tick. Must return an action within 2ms.
   * If it takes longer, default action (drift) is used.
   */
  act(observation: Observation): AgentAction;
  
  /**
   * Called after each tick with the reward signal.
   * Use this for online learning during the match.
   */
  learn(observation: Observation, reward: number): void;
}
```

### 3. Network Lockdown (Critical for Fair Play)

```typescript
// network-lockdown.ts — Service Worker that blocks ALL network during game

// ===== service-worker.js =====
const SW_CODE = `
let gameActive = false;

self.addEventListener('message', (event) => {
  if (event.data.type === 'GAME_START') gameActive = true;
  if (event.data.type === 'GAME_END') gameActive = false;
});

self.addEventListener('fetch', (event) => {
  if (gameActive) {
    // Block EVERYTHING during game
    event.respondWith(
      new Response('Network blocked during game', { status: 403 })
    );
    return;
  }
  event.respondWith(fetch(event.request));
});
`;

// ===== In-worker lockdown (belt AND suspenders) =====
function lockdownWorkerNetwork(workerScope: any) {
  // Delete all network APIs from the worker scope
  const forbidden = [
    'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
    'RTCPeerConnection', 'RTCDataChannel',
    'navigator.sendBeacon', 'navigator.serviceWorker',
  ];
  
  // Override fetch
  workerScope.fetch = () => {
    throw new Error('Network access is forbidden during game');
  };
  
  // Override XMLHttpRequest
  workerScope.XMLHttpRequest = class {
    open() { throw new Error('Network access is forbidden'); }
  };
  
  // Override WebSocket
  workerScope.WebSocket = class {
    constructor() { throw new Error('Network access is forbidden'); }
  };
  
  // Override importScripts (prevent loading external code)
  workerScope.importScripts = () => {
    throw new Error('importScripts is forbidden during game');
  };
  
  // Freeze to prevent re-assignment
  Object.freeze(workerScope.fetch);
  Object.freeze(workerScope.XMLHttpRequest);
  Object.freeze(workerScope.WebSocket);
}

// ===== CSP Header for extra safety =====
// Set this on the game page:
// Content-Security-Policy: connect-src 'none'; script-src 'self'
```

### 4. Agent Runner (Web Worker Sandbox)

```typescript
// agent-worker.ts — Runs inside a Web Worker

// This is the Web Worker that hosts one agent
// It receives observations and returns actions

let agent: AgentModule | null = null;
const ACTION_TIMEOUT_MS = 2;

// On worker init, receive the agent's source code
self.onmessage = async (event: MessageEvent) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'LOAD_AGENT': {
      // Lock down network BEFORE loading agent code
      lockdownWorkerNetwork(self);
      
      // The agent code is passed as a string and evaluated
      // It must export an object conforming to AgentModule
      try {
        // Create a sandboxed evaluation context
        const moduleFactory = new Function(
          'tf',           // TensorFlow.js (pre-bundled)
          'Math',         // Allow math
          'Array',        // Allow arrays  
          'Float32Array', // Allow typed arrays
          'console',      // Allow logging (for debug)
          `
          "use strict";
          ${data.agentCode}
          return module.exports;
          `
        );
        
        // We pre-bundle tf.js into the worker
        agent = moduleFactory(tf, Math, Array, Float32Array, console);
        agent!.init(data.config);
        
        self.postMessage({ type: 'AGENT_READY' });
      } catch (e) {
        self.postMessage({ type: 'AGENT_ERROR', error: String(e) });
      }
      break;
    }
    
    case 'TICK': {
      if (!agent) {
        self.postMessage({ type: 'ACTION', action: { thrust: 0, turn: 0, shoot: false } });
        return;
      }
      
      const obs: Observation = data.observation;
      const reward: number = data.reward;
      
      try {
        // Let agent learn from previous tick
        agent.learn(obs, reward);
        
        // Get action with timeout
        const action = agent.act(obs);
        
        // Validate action
        const safeAction: AgentAction = {
          thrust: Math.max(-1, Math.min(1, Number(action.thrust) || 0)),
          turn: Math.max(-1, Math.min(1, Number(action.turn) || 0)),
          shoot: Boolean(action.shoot),
        };
        
        self.postMessage({ type: 'ACTION', action: safeAction });
      } catch (e) {
        // Agent crashed — return no-op
        self.postMessage({ type: 'ACTION', action: { thrust: 0, turn: 0, shoot: false } });
      }
      break;
    }
  }
};
```

### 5. Example Agent: Neural Net with Online RL

```typescript
// example-agent.ts — A sample agent using TensorFlow.js
// This is what a PLAYER would write and submit

// @ts-nocheck — this runs inside the worker sandbox
const module = { exports: null };

module.exports = (() => {
  let model: any;
  let optimizer: any;
  let replayBuffer: Array<{ obs: number[], action: number[], reward: number, nextObs: number[] }> = [];
  let prevObsVec: number[] | null = null;
  let prevAction: number[] | null = null;
  const GAMMA = 0.95;
  const LEARNING_RATE = 0.001;
  const REPLAY_SIZE = 500;
  const BATCH_SIZE = 32;
  const EPSILON_START = 0.3;
  const EPSILON_END = 0.05;
  const EPSILON_DECAY = 3000;
  let stepCount = 0;
  
  function obsToVector(obs: Observation): number[] {
    const v: number[] = [];
    
    // Self state (8 values)
    v.push(
      obs.self.speed / 8,
      obs.self.angle / Math.PI,
      obs.self.health / 100,
      obs.self.ammo / 50,
      obs.self.fuel / 1000,
      obs.self.weight,
      obs.self.cooldown / 5,
      obs.distanceToWall / 1000,
    );
    
    // Nearest 3 enemies (5 values each = 15)
    const enemies = obs.enemies
      .filter(e => e.alive)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    
    for (let i = 0; i < 3; i++) {
      if (enemies[i]) {
        v.push(
          enemies[i].relX / 1000,
          enemies[i].relY / 1000,
          enemies[i].bearingAngle / Math.PI,
          enemies[i].distance / 1000,
          (enemies[i].relVx) / 8,
        );
      } else {
        v.push(0, 0, 0, 1, 0); // no enemy — max distance
      }
    }
    
    // Nearest 3 bullets (4 values each = 12)
    const bullets = obs.nearbyBullets
      .filter(b => !b.isMine)
      .sort((a, b) => 
        (a.relX**2 + a.relY**2) - (b.relX**2 + b.relY**2)
      )
      .slice(0, 3);
    
    for (let i = 0; i < 3; i++) {
      if (bullets[i]) {
        v.push(
          bullets[i].relX / 500,
          bullets[i].relY / 500,
          bullets[i].relVx / 12,
          bullets[i].relVy / 12,
        );
      } else {
        v.push(0, 0, 0, 0);
      }
    }
    
    return v; // 35 total features
  }
  
  // Action space: [thrust, turn, shootProbability]
  // We discretize into 18 combos for DQN simplicity:
  // thrust ∈ {-1, 0, 1} × turn ∈ {-1, 0, 1} × shoot ∈ {0, 1}
  const ACTION_COMBOS = [];
  for (const thrust of [-1, 0, 1]) {
    for (const turn of [-1, 0, 1]) {
      for (const shoot of [0, 1]) {
        ACTION_COMBOS.push({ thrust, turn, shoot: shoot === 1 });
      }
    }
  }
  
  function createModel() {
    const inputDim = 35;
    const numActions = ACTION_COMBOS.length; // 18
    
    model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [inputDim], units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: numActions, activation: 'linear' }), // Q-values
      ]
    });
    
    optimizer = tf.train.adam(LEARNING_RATE);
  }
  
  function getEpsilon(): number {
    return EPSILON_END + (EPSILON_START - EPSILON_END) * 
      Math.exp(-stepCount / EPSILON_DECAY);
  }
  
  return {
    init(config: any) {
      createModel();
    },
    
    act(obs: Observation): AgentAction {
      const obsVec = obsToVector(obs);
      stepCount++;
      
      let actionIndex: number;
      
      // Epsilon-greedy
      if (Math.random() < getEpsilon()) {
        actionIndex = Math.floor(Math.random() * ACTION_COMBOS.length);
      } else {
        // Forward pass through network
        const input = tf.tensor2d([obsVec]);
        const qValues = model.predict(input) as any;
        actionIndex = qValues.argMax(1).dataSync()[0];
        input.dispose();
        qValues.dispose();
      }
      
      prevObsVec = obsVec;
      prevAction = [actionIndex];
      
      return ACTION_COMBOS[actionIndex];
    },
    
    learn(obs: Observation, reward: number) {
      if (prevObsVec === null || prevAction === null) return;
      
      const nextObsVec = obsToVector(obs);
      
      // Store in replay buffer
      replayBuffer.push({
        obs: prevObsVec,
        action: prevAction,
        reward,
        nextObs: nextObsVec,
      });
      
      if (replayBuffer.length > REPLAY_SIZE) {
        replayBuffer.shift();
      }
      
      // Train every 4 steps when we have enough data
      if (stepCount % 4 === 0 && replayBuffer.length >= BATCH_SIZE) {
        trainBatch();
      }
    }
  };
  
  function trainBatch() {
    // Sample random minibatch
    const batch = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      batch.push(replayBuffer[Math.floor(Math.random() * replayBuffer.length)]);
    }
    
    tf.tidy(() => {
      const states = tf.tensor2d(batch.map(b => b.obs));
      const nextStates = tf.tensor2d(batch.map(b => b.nextObs));
      
      // Current Q-values
      const currentQ = model.predict(states);
      
      // Next Q-values (for target)
      const nextQ = model.predict(nextStates);
      const nextQMax = nextQ.max(1);
      
      // Build target Q-values
      const targetData = currentQ.arraySync();
      const nextQData = nextQMax.arraySync();
      
      for (let i = 0; i < BATCH_SIZE; i++) {
        const actionIdx = batch[i].action[0];
        targetData[i][actionIdx] = batch[i].reward + GAMMA * nextQData[i];
      }
      
      const targets = tf.tensor2d(targetData);
      
      // One gradient step
      optimizer.minimize(() => {
        const pred = model.predict(states);
        return pred.sub(targets).square().mean();
      });
    });
  }
})();
```

### 6. Reward Shaping

```typescript
// rewards.ts — Compute reward signal for each agent each tick

function computeReward(
  jetId: string,
  prevState: GameState,
  currState: GameState,
  action: AgentAction,
): number {
  const prev = prevState.jets.get(jetId)!;
  const curr = currState.jets.get(jetId)!;
  
  if (!curr.alive) return -100; // death is very bad
  
  let reward = 0;
  
  // ── Survival bonus (small per tick) ──
  reward += 0.1;
  
  // ── Damage dealt ──
  for (const [otherId, otherJet] of currState.jets) {
    if (otherId === jetId) continue;
    const prevOther = prevState.jets.get(otherId)!;
    if (prevOther.alive && otherJet.health < prevOther.health) {
      // Check if our bullet caused this (simplified: any damage to enemy is good)
      reward += (prevOther.health - otherJet.health) * 0.5;
    }
    if (prevOther.alive && !otherJet.alive) {
      reward += 50; // kill bonus
    }
  }
  
  // ── Damage taken penalty ──
  if (curr.health < prev.health) {
    reward -= (prev.health - curr.health) * 0.3;
  }
  
  // ── Shooting penalty (resource conservation) ──
  if (action.shoot) {
    reward -= 0.5; // small cost to discourage spray
  }
  
  // ── Positional awareness ──
  // Penalty for being too close to wall
  const distToWall = CONFIG.ARENA_RADIUS - Math.sqrt(curr.x ** 2 + curr.y ** 2);
  if (distToWall < 100) {
    reward -= (100 - distToWall) * 0.01;
  }
  
  // ── Ammo conservation bonus ──
  // Late game ammo is more valuable
  const gameProgress = currState.tick / CONFIG.MAX_TICKS;
  if (gameProgress > 0.5 && curr.ammo > 10) {
    reward += 0.05; // small bonus for having ammo late
  }
  
  return reward;
}
```

### 7. Game Orchestrator

```typescript
// orchestrator.ts — Main thread game loop

class GameOrchestrator {
  private world: GameWorld;
  private agentWorkers: Map<string, Worker> = new Map();
  private pendingActions: Map<string, AgentAction> = new Map();
  private renderer: GameRenderer;
  
  async startGame(players: Array<{ id: string; code: string }>, seed: number) {
    // 1. Activate network lockdown
    navigator.serviceWorker.controller?.postMessage({ type: 'GAME_START' });
    
    // 2. Create world
    this.world = new GameWorld(players.map(p => p.id), seed);
    
    // 3. Spawn agent workers
    for (const player of players) {
      const worker = new Worker('/agent-worker.js');
      this.agentWorkers.set(player.id, worker);
      
      worker.postMessage({
        type: 'LOAD_AGENT',
        data: { agentCode: player.code, config: CONFIG },
      });
      
      // Wait for ready
      await new Promise<void>((resolve) => {
        worker.onmessage = (e) => {
          if (e.data.type === 'AGENT_READY') resolve();
        };
      });
      
      // Set up action listener
      worker.onmessage = (e) => {
        if (e.data.type === 'ACTION') {
          this.pendingActions.set(player.id, e.data.action);
        }
      };
    }
    
    // 4. Game loop
    this.renderer = new GameRenderer(document.getElementById('canvas') as HTMLCanvasElement);
    
    let prevState = structuredClone(this.world.state);
    
    const tickLoop = () => {
      // Send observations to all agents
      for (const [id, worker] of this.agentWorkers) {
        const jet = this.world.state.jets.get(id)!;
        if (!jet.alive) continue;
        
        const obs = this.buildObservation(id, this.world.state);
        const reward = computeReward(id, prevState, this.world.state, 
          this.pendingActions.get(id) ?? { thrust: 0, turn: 0, shoot: false });
        
        worker.postMessage({
          type: 'TICK',
          data: { observation: obs, reward },
        });
      }
      
      // Wait a frame for agents to respond, then step
      setTimeout(() => {
        prevState = structuredClone(this.world.state);
        this.world.step(this.pendingActions);
        this.pendingActions.clear();
        
        // Render
        this.renderer.draw(this.world.state);
        
        // Check game over
        const winner = this.world.getWinner();
        if (winner !== null || this.world.getAliveCount() <= 1) {
          this.endGame(winner);
          return;
        }
        
        // Next tick
        setTimeout(tickLoop, 1000 / CONFIG.TICK_RATE);
      }, ACTION_TIMEOUT_MS + 1);
    };
    
    tickLoop();
  }
  
  private buildObservation(jetId: string, state: GameState): Observation {
    const self = state.jets.get(jetId)!;
    
    const enemies = [...state.jets.values()]
      .filter(j => j.id !== jetId)
      .map(j => {
        const relX = j.x - self.x;
        const relY = j.y - self.y;
        const distance = Math.sqrt(relX ** 2 + relY ** 2);
        const angleToEnemy = Math.atan2(relY, relX);
        const bearingAngle = angleToEnemy - self.angle;
        
        return {
          relX, relY,
          relVx: j.vx - self.vx,
          relVy: j.vy - self.vy,
          angle: j.angle,
          distance,
          bearingAngle: Math.atan2(Math.sin(bearingAngle), Math.cos(bearingAngle)),
          alive: j.alive,
        };
      });
    
    const sensorRange = 500;
    const nearbyBullets = state.bullets
      .filter(b => {
        const dx = b.x - self.x;
        const dy = b.y - self.y;
        return dx * dx + dy * dy < sensorRange * sensorRange;
      })
      .map(b => ({
        relX: b.x - self.x,
        relY: b.y - self.y,
        relVx: b.vx - self.vx,
        relVy: b.vy - self.vy,
        isMine: b.ownerId === jetId,
      }));
    
    return {
      self: {
        vx: self.vx,
        vy: self.vy,
        speed: Math.sqrt(self.vx ** 2 + self.vy ** 2),
        angle: self.angle,
        health: self.health,
        ammo: self.ammo,
        fuel: self.fuel,
        weight: self.weight,
        cooldown: self.cooldown,
      },
      enemies,
      nearbyBullets,
      distanceToWall: CONFIG.ARENA_RADIUS - Math.sqrt(self.x ** 2 + self.y ** 2),
      tick: state.tick,
      lastAction: null,
      lastReward: 0,
    };
  }
  
  private async endGame(winnerId: string | null) {
    // Terminate all workers
    for (const worker of this.agentWorkers.values()) {
      worker.terminate();
    }
    
    // Re-enable network
    navigator.serviceWorker.controller?.postMessage({ type: 'GAME_END' });
    
    // Hash the replay for on-chain verification
    const replayData = JSON.stringify(this.world.replayLog);
    const replayHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(replayData)
    );
    
    console.log('Game Over! Winner:', winnerId);
    console.log('Replay hash:', Array.from(new Uint8Array(replayHash))
      .map(b => b.toString(16).padStart(2, '0')).join(''));
    
    // Submit result on-chain...
    this.submitResult(winnerId, replayHash);
  }
  
  private async submitResult(winnerId: string | null, replayHash: ArrayBuffer) {
    // Smart contract interaction would go here
  }
}
```

### 8. Token Economics (Smart Contract Sketch)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract JetArena {
    struct Match {
        bytes32 matchId;
        address[] players;
        uint256 stakePerPlayer;
        uint256 pot;
        address winner;
        bytes32 replayHash;
        bool settled;
        uint256 startTime;
    }
    
    mapping(bytes32 => Match) public matches;
    mapping(address => bytes32) public agentCodeHash; // IPFS CID of agent code
    
    uint256 public constant MIN_STAKE = 0.01 ether;
    uint256 public constant PLATFORM_FEE_BPS = 250; // 2.5%
    uint256 public constant MAX_PLAYERS = 8;
    
    event MatchCreated(bytes32 indexed matchId, uint256 stake);
    event PlayerJoined(bytes32 indexed matchId, address player);
    event MatchSettled(bytes32 indexed matchId, address winner, uint256 payout);
    
    // Players register their AI agent code hash
    function registerAgent(bytes32 codeHash) external {
        agentCodeHash[msg.sender] = codeHash;
    }
    
    // Create a new match lobby
    function createMatch(uint256 maxPlayers) external payable returns (bytes32) {
        require(msg.value >= MIN_STAKE, "Stake too low");
        require(maxPlayers >= 2 && maxPlayers <= MAX_PLAYERS, "Invalid player count");
        require(agentCodeHash[msg.sender] != bytes32(0), "Register agent first");
        
        bytes32 matchId = keccak256(abi.encodePacked(
            block.timestamp, msg.sender, block.prevrandao
        ));
        
        Match storage m = matches[matchId];
        m.matchId = matchId;
        m.stakePerPlayer = msg.value;
        m.pot = msg.value;
        m.startTime = block.timestamp;
        m.players.push(msg.sender);
        
        emit MatchCreated(matchId, msg.value);
        return matchId;
    }
    
    // Join an existing match
    function joinMatch(bytes32 matchId) external payable {
        Match storage m = matches[matchId];
        require(m.stakePerPlayer > 0, "Match not found");
        require(msg.value == m.stakePerPlayer, "Wrong stake amount");
        require(!m.settled, "Match already settled");
        require(agentCodeHash[msg.sender] != bytes32(0), "Register agent first");
        
        m.players.push(msg.sender);
        m.pot += msg.value;
        
        emit PlayerJoined(matchId, msg.sender);
    }
    
    // Submit game result (called by oracle/verifier nodes)
    // In production, use an optimistic oracle or ZK proof
    function settleMatch(
        bytes32 matchId,
        address winner,
        bytes32 replayHash
    ) external {
        // TODO: proper oracle verification
        Match storage m = matches[matchId];
        require(!m.settled, "Already settled");
        
        m.winner = winner;
        m.replayHash = replayHash;
        m.settled = true;
        
        uint256 fee = (m.pot * PLATFORM_FEE_BPS) / 10000;
        uint256 payout = m.pot - fee;
        
        payable(winner).transfer(payout);
        
        emit MatchSettled(matchId, winner, payout);
    }
}
```

---

## Key Design Decisions

<details>
<summary><strong>Why Web Workers for Agent Isolation?</strong></summary>

Each agent runs in its own Web Worker, which provides:
- **Memory isolation** — one agent can't read another's neural network weights
- **Fault isolation** — if an agent crashes, the game continues
- **Timeout enforcement** — if an agent is too slow, we use a no-op action
- **Network lockdown** — we delete `fetch`, `XMLHttpRequest`, `WebSocket` from the worker scope *before* loading agent code

The main thread acts as a trusted game server that feeds observations and collects actions.
</details>

<details>
<summary><strong>Why Deterministic Physics?</strong></summary>

Deterministic simulation with a seeded PRNG means:
- Any node can **replay the game** from the seed + agent code and get the exact same result
- This enables **on-chain dispute resolution** — if someone claims the result was wrong, any verifier can re-run the game
- The replay hash is a commitment to the entire game history
</details>

<details>
<summary><strong>Why Online RL During the Match?</strong></summary>

The example agent uses **DQN with experience replay** that learns *during* the 5-minute match. This creates emergent strategy:

- Early game: agent explores, tests different approaches (high $\epsilon$)
- Mid game: agent starts exploiting learned patterns (decaying $\epsilon$)
- Late game: agent uses refined policy with low $\epsilon$

Players compete by designing agents with:
- Better **network architectures** (how many layers, what features)
- Better **reward shaping** (the agent code can override reward interpretation)
- Pre-trained weights loaded at `init()` (from offline training against simulations)
- Clever **feature engineering** in `obsToVector()`
</details>

<details>
<summary><strong>Counter-Incentive Economics for Shooting</strong></summary>

Each shot costs:
- 1 ammo (finite: 50 total)
- 3 fuel (makes future movement more limited)
- +0.02 weight (permanently increases drag and reduces turn rate)

So an agent that fires all 50 bullets recklessly ends up with:
- $\text{weight} = 1.0 + 50 \times 0.02 = 2.0$ (double base weight)
- Extra drag: $0.005 \times 1.0 = 0.005$ reduction in drag coefficient
- Turn penalty: $0.008 \times 1.0 = 0.008$ radians/tick slower turning
- 150 fuel wasted on shooting alone

This creates a genuine **accuracy vs. volume** tradeoff that the RL agent must learn to balance.
</details>

---

## Strategy Landscape for Players

```
                     AGGRESSIVE
                        │
            ┌───────────┼───────────┐
            │ Spray &   │  Sniper   │
            │ Pray      │  (few     │
            │ (many     │  precise  │
            │ shots,    │  shots,   │
WASTEFUL ───│ heavy)    │  light)   │─── EFFICIENT
            │           │           │
            │ Rammer    │  Evader   │
            │ (close    │  (survive │
            │ range,    │  & pick   │
            │ all-in)   │  off)     │
            └───────────┼───────────┘
                        │
                    DEFENSIVE
```

The best agents will likely learn **adaptive** strategies — being aggressive when they have resource advantage and defensive when low on ammo/fuel.

## Getting Started

```bash
# Project structure
jet-arena/
├── src/
│   ├── world.ts              # Game physics
│   ├── orchestrator.ts       # Main game loop
│   ├── agent-worker.ts       # Worker sandbox
│   ├── network-lockdown.ts   # Security layer
│   ├── renderer.ts           # Canvas visualization
│   ├── rewards.ts            # Reward computation
│   └── contracts/
│       └── JetArena.sol      # On-chain settlement
├── agents/
│   ├── example-dqn.ts        # Example DQN agent
│   ├── example-ppo.ts        # Example PPO agent
│   └── example-heuristic.ts  # Rule-based baseline
├── public/
│   ├── index.html
│   └── service-worker.js
└── package.json
```

The TensorFlow.js library (~1.5MB gzipped) gets bundled into the agent worker at build time, so it's available offline. Players write their agent code implementing the `AgentModule` interface, and the platform handles sandboxing, execution, and settlement.