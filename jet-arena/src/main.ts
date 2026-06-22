import "./styles.css";

import { APP_DEFAULTS, resolveDefaultAgentKey, resolveDefaultBattlefieldKey } from "./app-defaults";
import { loadBattlefieldRegistry } from "./battlefield-config";
import { registerServiceWorker } from "./network-lockdown";
import { GameOrchestrator } from "./orchestrator";
import type { BattlefieldConfig, GameState, PickupConfig } from "./types";

type PoseKey = "idle" | "planning" | "attacking" | "hit-target" | "got-hit" | "low-fuel" | "down";
type SpriteFrame = { x: number; y: number; w: number; h: number };
type SpriteSheetManifest = {
  image?: string;
  sheetWidth?: number;
  sheetHeight?: number;
  poses: Partial<Record<PoseKey, SpriteFrame>>;
};
type SpriteSheetMeta = {
  imageUrl: string;
  sheetWidth: number;
  sheetHeight: number;
  poses: Partial<Record<PoseKey, SpriteFrame>>;
};
type AgentMeta = {
  label: string;
  code: string;
  sprites: Partial<Record<PoseKey, string>>;
  spriteSheet?: SpriteSheetMeta;
  topView?: string;
};
type PoseState = { pose: PoseKey; untilTick: number };
type JetSnapshot = {
  id: string;
  x: number;
  y: number;
  health: number;
  ammo: number;
  fuel: number;
  cooldown: number;
  alive: boolean;
};
type TickSnapshot = { tick: number; jets: Map<string, JetSnapshot> };

const toTitleCase = (value: string): string =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatAgentLabel = (fileStem: string): string => {
  if (fileStem.includes("dqn")) return "DQN (TF.js)";
  if (fileStem.startsWith("example-")) {
    return toTitleCase(fileStem.replace("example-", ""));
  }
  return toTitleCase(fileStem);
};

const loadAgentRegistry = (): Record<string, AgentMeta> => {
  const modules = import.meta.glob("../agents/*/agent.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const spriteModules = import.meta.glob("../agents/*/sprites/*.{png,jpg,jpeg,webp,svg}", {
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const spriteSheetImages = import.meta.glob("../agents/*/spritesheet.{png,jpg,jpeg,webp,svg}", {
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const spriteSheetManifests = import.meta.glob("../agents/*/spritesheet.json", {
    import: "default",
    eager: true,
  }) as Record<string, SpriteSheetManifest>;
  const topViewSprites = import.meta.glob("../agents/*/strikecraft-sprite-top.png", {
    import: "default",
    eager: true,
  }) as Record<string, string>;

  const spriteRegistry: Record<string, Partial<Record<PoseKey, string>>> = {};
  for (const [path, resolvedUrl] of Object.entries(spriteModules)) {
    const parts = path.split("/");
    const agentKey = parts.at(-3);
    const fileName = parts.at(-1);
    if (!agentKey || !fileName) continue;
    const pose = fileName.replace(/\.(png|jpg|jpeg|webp|svg)$/i, "") as PoseKey;
    if (!spriteRegistry[agentKey]) {
      spriteRegistry[agentKey] = {};
    }
    spriteRegistry[agentKey][pose] = resolvedUrl;
  }

  const spriteSheetRegistry: Record<string, SpriteSheetMeta> = {};
  for (const [path, imageUrl] of Object.entries(spriteSheetImages)) {
    const parts = path.split("/");
    const agentKey = parts.at(-2);
    if (!agentKey) continue;
    const manifestPath = path.replace(/spritesheet\.(png|jpg|jpeg|webp|svg)$/i, "spritesheet.json");
    const manifest = spriteSheetManifests[manifestPath];
    if (!manifest?.poses) continue;

    const imageFile = path.split("/").pop() ?? "";
    if (manifest.image && manifest.image !== imageFile) continue;

    spriteSheetRegistry[agentKey] = {
      imageUrl,
      sheetWidth: manifest.sheetWidth ?? 1024,
      sheetHeight: manifest.sheetHeight ?? 1024,
      poses: manifest.poses,
    };
  }

  const topViewRegistry: Record<string, string> = {};
  for (const [path, resolvedUrl] of Object.entries(topViewSprites)) {
    const parts = path.split("/");
    const agentKey = parts.at(-2);
    if (!agentKey) continue;
    topViewRegistry[agentKey] = resolvedUrl;
  }

  const entries = Object.entries(modules).map(([path, code]) => {
    const parts = path.split("/");
    const directoryName = parts.at(-2) ?? "";
    const key = directoryName
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    const label = formatAgentLabel(directoryName);
    return [
      key,
      {
        label,
        code,
        sprites: spriteRegistry[key] ?? {},
        spriteSheet: spriteSheetRegistry[key],
        topView: topViewRegistry[key],
      },
    ] as const;
  });

  entries.sort((left, right) => left[1].label.localeCompare(right[1].label));
  return Object.fromEntries(entries);
};

const AGENT_REGISTRY = loadAgentRegistry();
const AGENT_KEYS = Object.keys(AGENT_REGISTRY);
const BATTLEFIELD_REGISTRY = loadBattlefieldRegistry();
const BATTLEFIELD_KEYS = Object.keys(BATTLEFIELD_REGISTRY);

if (AGENT_KEYS.length === 0) {
  throw new Error("No agent directories found in agents/*/agent.ts.");
}
if (BATTLEFIELD_KEYS.length === 0) {
  throw new Error("No battlefield configurations available.");
}

const FALLBACK_AGENT_KEY = AGENT_KEYS[0];
if (!FALLBACK_AGENT_KEY) {
  throw new Error("No default agent key available.");
}
const FALLBACK_AGENT = AGENT_REGISTRY[FALLBACK_AGENT_KEY];
if (!FALLBACK_AGENT) {
  throw new Error("Default agent is missing from registry.");
}

const AGENT_ENTRIES = Object.entries(AGENT_REGISTRY);
const BATTLEFIELD_ENTRIES = Object.entries(BATTLEFIELD_REGISTRY);

const buildAgentOptions = (): string =>
  AGENT_ENTRIES.map(([key, meta]) => `<option value="${key}">${meta.label}</option>`).join("");

const buildBattlefieldOptions = (): string =>
  BATTLEFIELD_ENTRIES.map(([key, config]) => `<option value="${key}">${config.name}</option>`).join(
    "",
  );

const POSE_PRIORITY: Record<PoseKey, number> = {
  idle: 0,
  planning: 1,
  attacking: 2,
  "low-fuel": 3,
  "hit-target": 4,
  "got-hit": 5,
  down: 6,
};

const FALLBACK_POSE_SVG: Record<PoseKey, string> = {
  idle: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%23111f36'/><text x='12' y='50' fill='%23cbd5e1' font-size='12' font-family='monospace'>IDLE</text></svg>",
  planning:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%231b2b4a'/><text x='12' y='50' fill='%2393c5fd' font-size='12' font-family='monospace'>PLANNING</text></svg>",
  attacking:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%23372020'/><text x='12' y='50' fill='%23fca5a5' font-size='12' font-family='monospace'>ATTACKING</text></svg>",
  "hit-target":
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%2313342b'/><text x='12' y='50' fill='%2386efac' font-size='12' font-family='monospace'>HIT TARGET</text></svg>",
  "got-hit":
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%23311b1b'/><text x='12' y='50' fill='%23fda4af' font-size='12' font-family='monospace'>GOT HIT</text></svg>",
  "low-fuel":
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%23322716'/><text x='12' y='50' fill='%23fdba74' font-size='12' font-family='monospace'>LOW FUEL</text></svg>",
  down: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%23111520'/><text x='12' y='50' fill='%239ca3af' font-size='12' font-family='monospace'>DOWN</text></svg>",
};

const controls = document.getElementById("controls");
const status = document.getElementById("status");
const canvas = document.getElementById("arena");
const jetStatsPanel = document.getElementById("jet-stats");

if (
  !(controls instanceof HTMLElement) ||
  !(status instanceof HTMLElement) ||
  !(canvas instanceof HTMLCanvasElement) ||
  !(jetStatsPanel instanceof HTMLElement)
) {
  throw new Error("Missing app mount elements.");
}

controls.innerHTML = `
  <h1>Jet Arena</h1>
  <p>Offline-in-match AI arena. Choose agents and press start.</p>

  <div class="row">
    <label for="battlefield">Battlefield</label>
    <select id="battlefield">${buildBattlefieldOptions()}</select>
  </div>

  <div class="row">
    <label for="seed">Seed</label>
    <input id="seed" type="number" value="${APP_DEFAULTS.seed}" />
  </div>

  <div class="row">
    <label for="agent-a">Agent A</label>
    <select id="agent-a">${buildAgentOptions()}</select>
  </div>

  <div class="row">
    <label for="agent-b">Agent B</label>
    <select id="agent-b">${buildAgentOptions()}</select>
  </div>

  <div class="row">
    <label for="agent-c">Agent C</label>
    <select id="agent-c">${buildAgentOptions()}</select>
  </div>

  <div class="row">
    <label for="agent-d">Agent D</label>
    <select id="agent-d">${buildAgentOptions()}</select>
  </div>

  <div class="row pickup-config-title">Pickups</div>
  <div class="row">
    <label for="pickup-enabled">Enabled</label>
    <input id="pickup-enabled" type="checkbox" checked />
  </div>
  <div class="row">
    <label for="pickup-mode">Mode</label>
    <select id="pickup-mode">
      <option value="random">Random</option>
      <option value="fixed">Fixed</option>
    </select>
  </div>
  <div class="row">
    <label for="pickup-random-ceiling">Random Ceiling</label>
    <input id="pickup-random-ceiling" type="number" min="0" value="6" />
  </div>
  <div class="row pickup-fixed-row">
    <label for="pickup-fixed-health">Fixed Health Count</label>
    <input id="pickup-fixed-health" type="number" min="0" value="1" />
  </div>
  <div class="row pickup-fixed-row">
    <label for="pickup-fixed-ammo">Fixed Ammo Count</label>
    <input id="pickup-fixed-ammo" type="number" min="0" value="2" />
  </div>
  <div class="row pickup-fixed-row">
    <label for="pickup-fixed-fuel">Fixed Fuel Count</label>
    <input id="pickup-fixed-fuel" type="number" min="0" value="2" />
  </div>
  <div class="row">
    <label for="pickup-respawn">Respawn Interval (ticks)</label>
    <input id="pickup-respawn" type="number" min="1" value="90" />
  </div>

  <div class="row">
    <button id="start" class="primary">Start Match</button>
  </div>
  <div class="row">
    <button id="reset">Stop Match</button>
  </div>
`;

const seedInput = controls.querySelector("#seed");
const battlefieldSelect = controls.querySelector("#battlefield");
const agentA = controls.querySelector("#agent-a");
const agentB = controls.querySelector("#agent-b");
const agentC = controls.querySelector("#agent-c");
const agentD = controls.querySelector("#agent-d");
const pickupEnabled = controls.querySelector("#pickup-enabled");
const pickupMode = controls.querySelector("#pickup-mode");
const pickupRandomCeiling = controls.querySelector("#pickup-random-ceiling");
const pickupFixedHealth = controls.querySelector("#pickup-fixed-health");
const pickupFixedAmmo = controls.querySelector("#pickup-fixed-ammo");
const pickupFixedFuel = controls.querySelector("#pickup-fixed-fuel");
const pickupRespawn = controls.querySelector("#pickup-respawn");
const startButton = controls.querySelector("#start");
const resetButton = controls.querySelector("#reset");
let lastEvent = "booting";

if (
  !(seedInput instanceof HTMLInputElement) ||
  !(battlefieldSelect instanceof HTMLSelectElement) ||
  !(agentA instanceof HTMLSelectElement) ||
  !(agentB instanceof HTMLSelectElement) ||
  !(agentC instanceof HTMLSelectElement) ||
  !(agentD instanceof HTMLSelectElement) ||
  !(pickupEnabled instanceof HTMLInputElement) ||
  !(pickupMode instanceof HTMLSelectElement) ||
  !(pickupRandomCeiling instanceof HTMLInputElement) ||
  !(pickupFixedHealth instanceof HTMLInputElement) ||
  !(pickupFixedAmmo instanceof HTMLInputElement) ||
  !(pickupFixedFuel instanceof HTMLInputElement) ||
  !(pickupRespawn instanceof HTMLInputElement) ||
  !(startButton instanceof HTMLButtonElement) ||
  !(resetButton instanceof HTMLButtonElement)
) {
  throw new Error("Missing control elements.");
}

const selectDefaultAgent = (select: HTMLSelectElement, preferredKey: string): void => {
  const nextValue = AGENT_REGISTRY[preferredKey] ? preferredKey : FALLBACK_AGENT_KEY;
  select.value = nextValue;
};

const defaultAgentKey = resolveDefaultAgentKey(AGENT_REGISTRY, FALLBACK_AGENT_KEY);
selectDefaultAgent(agentA, defaultAgentKey);
selectDefaultAgent(agentB, defaultAgentKey);
selectDefaultAgent(agentC, defaultAgentKey);
selectDefaultAgent(agentD, defaultAgentKey);

const initialBattlefieldKey = resolveDefaultBattlefieldKey(
  BATTLEFIELD_REGISTRY,
  APP_DEFAULTS.fallbackBattlefieldKey,
);
battlefieldSelect.value = initialBattlefieldKey ?? APP_DEFAULTS.fallbackBattlefieldKey;

const getSelectedBattlefield = (): BattlefieldConfig => {
  const selected =
    BATTLEFIELD_REGISTRY[battlefieldSelect.value] ??
    BATTLEFIELD_REGISTRY[APP_DEFAULTS.fallbackBattlefieldKey] ??
    BATTLEFIELD_ENTRIES[0]?.[1];
  if (!selected) {
    throw new Error("No battlefield configurations available.");
  }
  return selected;
};

const applyCanvasAspect = (battlefield: BattlefieldConfig): void => {
  const [aspectW, aspectH] = battlefield.canvasAspect ?? [4, 3];
  const maxWidth = 1200;
  const width = maxWidth;
  const height = Math.max(480, Math.round((maxWidth * aspectH) / Math.max(1, aspectW)));
  canvas.width = width;
  canvas.height = height;
};

applyCanvasAspect(getSelectedBattlefield());
battlefieldSelect.addEventListener("change", () => {
  applyCanvasAspect(getSelectedBattlefield());
});

const syncPickupModeUi = (): void => {
  const isFixed = pickupMode.value === "fixed";
  controls.querySelectorAll<HTMLElement>(".pickup-fixed-row").forEach((element) => {
    element.style.display = isFixed ? "block" : "none";
  });
  pickupRandomCeiling.disabled = isFixed || !pickupEnabled.checked;
  pickupMode.disabled = !pickupEnabled.checked;
  pickupFixedHealth.disabled = !isFixed || !pickupEnabled.checked;
  pickupFixedAmmo.disabled = !isFixed || !pickupEnabled.checked;
  pickupFixedFuel.disabled = !isFixed || !pickupEnabled.checked;
  pickupRespawn.disabled = !pickupEnabled.checked;
};

pickupEnabled.addEventListener("change", syncPickupModeUi);
pickupMode.addEventListener("change", syncPickupModeUi);
syncPickupModeUi();

const jetAgentKeyById = new Map<string, string>();
const jetPoseById = new Map<string, PoseState>();
let previousStateSnapshot: TickSnapshot | null = null;

const createTickSnapshot = (state: GameState): TickSnapshot => ({
  tick: state.tick,
  jets: new Map(
    [...state.jets.values()].map((jet) => [
      jet.id,
      {
        id: jet.id,
        x: jet.x,
        y: jet.y,
        health: jet.health,
        ammo: jet.ammo,
        fuel: jet.fuel,
        cooldown: jet.cooldown,
        alive: jet.alive,
      },
    ]),
  ),
});

const choosePoseSprite = (agentKey: string, pose: PoseKey): string => {
  const sprite = AGENT_REGISTRY[agentKey]?.sprites[pose] ?? AGENT_REGISTRY[agentKey]?.sprites.idle;
  return sprite ?? FALLBACK_POSE_SVG[pose];
};

const choosePoseFrame = (agentKey: string, pose: PoseKey): SpriteFrame | null => {
  const sheet = AGENT_REGISTRY[agentKey]?.spriteSheet;
  if (!sheet) return null;
  return sheet.poses[pose] ?? sheet.poses.idle ?? null;
};

const renderPoseVisual = (agentKey: string, pose: PoseKey, roleLabel: string): string => {
  const frame = choosePoseFrame(agentKey, pose);
  const sheet = AGENT_REGISTRY[agentKey]?.spriteSheet;
  if (frame && sheet) {
    const viewSize = 112;
    const scale = Math.max(viewSize / frame.w, viewSize / frame.h);
    const bgW = Math.round(sheet.sheetWidth * scale);
    const bgH = Math.round(sheet.sheetHeight * scale);
    const bgX = Math.round(frame.x * scale);
    const bgY = Math.round(frame.y * scale);
    return `
      <div class="jet-pose-sheet-wrap">
        <div
          class="jet-pose-sheet"
          style="width:${viewSize}px;height:${viewSize}px;background-image:url('${sheet.imageUrl}');background-size:${bgW}px ${bgH}px;background-position:-${bgX}px -${bgY}px;"
          role="img"
          aria-label="${roleLabel} ${pose}"
        ></div>
      </div>
    `;
  }

  const poseSprite = choosePoseSprite(agentKey, pose);
  return `<img class="jet-pose" src="${poseSprite}" alt="${roleLabel} ${pose}" />`;
};

const getJetPose = (jetId: string, tick: number): PoseKey => {
  const state = jetPoseById.get(jetId);
  if (!state || state.untilTick < tick) return "idle";
  return state.pose;
};

const setJetPose = (jetId: string, pose: PoseKey, tick: number, ttl = 14): void => {
  const current = jetPoseById.get(jetId);
  if (current && current.untilTick >= tick && POSE_PRIORITY[current.pose] > POSE_PRIORITY[pose]) {
    return;
  }
  jetPoseById.set(jetId, { pose, untilTick: tick + ttl });
};

const inferPlanning = (state: GameState, jetId: string): boolean => {
  const self = state.jets.get(jetId);
  if (!self || !self.alive || self.cooldown > 0 || self.ammo <= 0) return false;
  let closestEnemyDistance = Number.POSITIVE_INFINITY;
  for (const candidate of state.jets.values()) {
    if (candidate.id === jetId || !candidate.alive) continue;
    const dx = candidate.x - self.x;
    const dy = candidate.y - self.y;
    const distance = Math.hypot(dx, dy);
    if (distance < closestEnemyDistance) closestEnemyDistance = distance;
  }
  return closestEnemyDistance < 240;
};

const updateJetPoseState = (state: GameState): void => {
  if (!previousStateSnapshot) {
    for (const jet of state.jets.values()) {
      setJetPose(jet.id, jet.alive ? "idle" : "down", state.tick, 8);
    }
    previousStateSnapshot = createTickSnapshot(state);
    return;
  }

  const previousJets = previousStateSnapshot.jets;
  const attackedThisTick = new Set<string>(state.recentHitEvents.map((event) => event.attackerId));
  const damagedThisTick = new Set<string>(state.recentHitEvents.map((event) => event.targetId));
  const fuelLossThisTick = new Set<string>();
  const ammoSpentThisTick = new Set<string>();

  for (const jet of state.jets.values()) {
    const prev = previousJets.get(jet.id);
    if (!prev) continue;
    if (prev.fuel - jet.fuel > 8) fuelLossThisTick.add(jet.id);
    if (jet.ammo < prev.ammo) ammoSpentThisTick.add(jet.id);
  }

  for (const jet of state.jets.values()) {
    if (!jet.alive) {
      setJetPose(jet.id, "down", state.tick, 30);
      continue;
    }
    if (damagedThisTick.has(jet.id)) {
      setJetPose(jet.id, "got-hit", state.tick, 20);
    }
    if (attackedThisTick.has(jet.id)) {
      setJetPose(jet.id, "hit-target", state.tick, 16);
    } else if (ammoSpentThisTick.has(jet.id) || jet.cooldown > 0) {
      setJetPose(jet.id, "attacking", state.tick, 12);
    } else if (fuelLossThisTick.has(jet.id) || jet.fuel < 220) {
      setJetPose(jet.id, "low-fuel", state.tick, 16);
    } else if (inferPlanning(state, jet.id)) {
      setJetPose(jet.id, "planning", state.tick, 10);
    } else {
      setJetPose(jet.id, "idle", state.tick, 8);
    }
  }

  previousStateSnapshot = createTickSnapshot(state);
};

const orchestrator = new GameOrchestrator(canvas, {
  onTick: (state) => {
    updateJetPoseState(state);
    const jets = [...state.jets.values()];
    const alive = jets.filter((jet) => jet.alive).length;
    const moving = jets.filter((jet) => jet.alive && Math.hypot(jet.vx, jet.vy) > 0.2).length;
    const totalCollected =
      state.pickupStats.totalCollected.health +
      state.pickupStats.totalCollected.ammo +
      state.pickupStats.totalCollected.fuel;
    status.textContent = `tick=${state.tick} alive=${alive} moving=${moving} bullets=${state.bullets.length} pickups=${state.pickups.length} collected=${totalCollected} | ${lastEvent}`;

    const statCards = jets
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((jet) => {
        const speed = Math.hypot(jet.vx, jet.vy);
        const hpPct = Math.max(0, Math.min(100, (jet.health / 100) * 100));
        const fuelPct = Math.max(0, Math.min(100, (jet.fuel / 1000) * 100));
        const ammoPct = Math.max(0, Math.min(100, (jet.ammo / 50) * 100));
        const accent = colorForJet(jet.id);
        const agentKey = jetAgentKeyById.get(jet.id) ?? FALLBACK_AGENT_KEY;
        const pose = getJetPose(jet.id, state.tick);
        const roleLabel = AGENT_REGISTRY[agentKey]?.label ?? "Unknown";
        const poseVisual = renderPoseVisual(agentKey, pose, roleLabel);
        const collisionCount = Math.max(0, jet.collisionCount);
        const collisionDamage = Math.max(0, jet.collisionDamageTaken);
        const lastHitLabel = jet.lastCollision
          ? `HIT ${jet.lastCollision.wallType.toUpperCase()} @ ${jet.lastCollision.x.toFixed(0)},${jet.lastCollision.y.toFixed(0)}`
          : "HIT NONE";
        const lastOut = formatJetIdForStat(jet.lastHitDealtToId);
        const lastIn = formatJetIdForStat(jet.lastHitTakenFromId);
        const collectedTotal =
          jet.pickupsCollected.health + jet.pickupsCollected.ammo + jet.pickupsCollected.fuel;
        const pickupTally =
          collectedTotal > 0
            ? `<div class="pickup-tally"><span title="Health pickups">+HP x${jet.pickupsCollected.health}</span><span title="Ammo pickups">+AMMO x${jet.pickupsCollected.ammo}</span><span title="Fuel pickups">+FUEL x${jet.pickupsCollected.fuel}</span></div>`
            : "";

        return `
          <article class="jet-card ${jet.alive ? "alive" : "down"}" style="--accent:${accent}">
            <div class="jet-card-layout">
              <div class="jet-card-media">${poseVisual}</div>
              <div class="jet-card-stats">
                <header>
                  <span class="jet-id">${jet.id}</span>
                  <span class="jet-state">${jet.alive ? pose.toUpperCase() : "DOWN"}</span>
                </header>
                <div class="agent-role">${roleLabel}</div>
                <div class="bar-row"><span>HP</span><div class="bar"><i style="width:${hpPct}%"></i></div><b>${Math.max(0, jet.health).toFixed(0)}</b></div>
                <div class="bar-row"><span>FUEL</span><div class="bar"><i style="width:${fuelPct}%"></i></div><b>${Math.max(0, jet.fuel).toFixed(0)}</b></div>
                <div class="bar-row"><span>AMMO</span><div class="bar"><i style="width:${ammoPct}%"></i></div><b>${Math.max(0, jet.ammo)}</b></div>
                <footer>SPD ${speed.toFixed(2)} | ALT ${(jet.altitude * 100).toFixed(0)}% | CD ${jet.cooldown}</footer>
                <div class="combat-row"><span>HITS ${jet.enemyHitsLanded}</span><span>TAKEN ${jet.enemyHitsTaken}</span></div>
                <div class="combat-row"><span title="${jet.lastHitDealtToId ?? "NONE"}">LAST_OUT ${lastOut}</span><span title="${jet.lastHitTakenFromId ?? "NONE"}">LAST_IN ${lastIn}</span></div>
                ${pickupTally}
                <footer>COLL ${collisionCount} | DMG ${collisionDamage.toFixed(1)} | ${lastHitLabel}</footer>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    jetStatsPanel.innerHTML = statCards;
  },
  onStatus: (message) => {
    lastEvent = message;
    status.textContent = message;
  },
  onGameEnd: (winnerId, replayHashHex) => {
    setControlsDisabled(false);
    const winnerText = winnerId ?? "draw";
    lastEvent = `winner=${winnerText}`;
    status.textContent = `winner=${winnerText} replay=${replayHashHex.slice(0, 16)}...`;
  },
});

const colorForJet = (id: string): string => {
  const palette = ["#22d3ee", "#f43f5e", "#f59e0b", "#4ade80", "#a78bfa", "#fb7185"];
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 1)) % palette.length;
  }
  return palette[hash] ?? "#22d3ee";
};

const formatJetIdForStat = (value: string | null): string => {
  if (!value) return "NONE";
  const maxLength = 24;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
};

const buildPlayers = (): Array<{ id: string; code: string; agentKey: string }> => {
  const picks = [agentA.value, agentB.value, agentC.value, agentD.value];
  return picks.map((pick, index) => ({
    id: `jet-${index + 1}-${(AGENT_REGISTRY[pick]?.label ?? "unknown").toLowerCase()}`,
    code: AGENT_REGISTRY[pick]?.code ?? FALLBACK_AGENT.code,
    agentKey: AGENT_REGISTRY[pick] ? pick : FALLBACK_AGENT_KEY,
  }));
};

const preloadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to preload sprite: ${url}`));
    image.src = url;
  });

const toNonNegativeInteger = (value: string, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const buildPickupConfigFromControls = (): PickupConfig => ({
  enabled: pickupEnabled.checked,
  mode: pickupMode.value === "fixed" ? "fixed" : "random",
  fixedCounts: {
    health: toNonNegativeInteger(pickupFixedHealth.value, 1),
    ammo: toNonNegativeInteger(pickupFixedAmmo.value, 2),
    fuel: toNonNegativeInteger(pickupFixedFuel.value, 2),
  },
  randomCeiling: toNonNegativeInteger(pickupRandomCeiling.value, 6),
  respawnIntervalTicks: Math.max(1, toNonNegativeInteger(pickupRespawn.value, 90)),
});

const setControlsDisabled = (disabled: boolean): void => {
  seedInput.disabled = disabled;
  battlefieldSelect.disabled = disabled;
  agentA.disabled = disabled;
  agentB.disabled = disabled;
  agentC.disabled = disabled;
  agentD.disabled = disabled;
  pickupEnabled.disabled = disabled;
  pickupMode.disabled = disabled;
  pickupRandomCeiling.disabled = disabled || pickupMode.value === "fixed" || !pickupEnabled.checked;
  pickupFixedHealth.disabled = disabled || pickupMode.value !== "fixed" || !pickupEnabled.checked;
  pickupFixedAmmo.disabled = disabled || pickupMode.value !== "fixed" || !pickupEnabled.checked;
  pickupFixedFuel.disabled = disabled || pickupMode.value !== "fixed" || !pickupEnabled.checked;
  pickupRespawn.disabled = disabled || !pickupEnabled.checked;
  startButton.disabled = disabled;
  resetButton.disabled = !disabled;
};

const startMatch = async (): Promise<void> => {
  const seed = Number(seedInput.value);
  const normalizedSeed = Number.isFinite(seed) ? seed : APP_DEFAULTS.seed;
  const battlefield = getSelectedBattlefield();
  const pickupConfig = buildPickupConfigFromControls();
  setControlsDisabled(true);
  try {
    applyCanvasAspect(battlefield);
    const players = buildPlayers();
    const jetSprites = new Map<string, HTMLImageElement>();
    await Promise.all(
      players.map(async (player) => {
        const spriteUrl = AGENT_REGISTRY[player.agentKey]?.topView;
        if (!spriteUrl) return;
        try {
          const image = await preloadImage(spriteUrl);
          jetSprites.set(player.id, image);
        } catch (error) {
          console.warn(
            `Unable to load top-view sprite for ${player.id}; using fallback jet shape.`,
            error,
          );
        }
      }),
    );
    jetAgentKeyById.clear();
    jetPoseById.clear();
    previousStateSnapshot = null;
    for (const player of players) {
      jetAgentKeyById.set(player.id, player.agentKey);
    }
    await orchestrator.start(
      players.map((player) => ({ id: player.id, code: player.code })),
      normalizedSeed,
      battlefield,
      jetSprites,
      pickupConfig,
    );
  } catch (error) {
    setControlsDisabled(false);
    throw error;
  }
};

startButton.addEventListener("click", () => {
  void startMatch();
});

resetButton.addEventListener("click", () => {
  orchestrator.stop();
  setControlsDisabled(false);
  jetPoseById.clear();
  previousStateSnapshot = null;
  lastEvent = "stopped";
  status.textContent = "Match stopped.";
});

void registerServiceWorker();
setControlsDisabled(false);
void startMatch();
