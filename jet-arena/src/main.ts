import aggressiveCode from "../agents/example-aggressive.ts?raw";
import dqnCode from "../agents/example-dqn.ts?raw";
import evaderCode from "../agents/example-evader.ts?raw";
import heuristicCode from "../agents/example-heuristic.ts?raw";

import { registerServiceWorker } from "./network-lockdown";
import { GameOrchestrator } from "./orchestrator";
import "./styles.css";

type AgentKey = "heuristic" | "aggressive" | "evader" | "dqn";

const AGENT_REGISTRY: Record<AgentKey, { label: string; code: string }> = {
  heuristic: { label: "Heuristic", code: heuristicCode },
  aggressive: { label: "Aggressive", code: aggressiveCode },
  evader: { label: "Evader", code: evaderCode },
  dqn: { label: "DQN (TF.js)", code: dqnCode },
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
    <label for="seed">Seed</label>
    <input id="seed" type="number" value="1337" />
  </div>

  <div class="row">
    <label for="agent-a">Agent A</label>
    <select id="agent-a">
      <option value="heuristic">Heuristic</option>
      <option value="aggressive">Aggressive</option>
      <option value="evader">Evader</option>
      <option value="dqn">DQN (TF.js)</option>
    </select>
  </div>

  <div class="row">
    <label for="agent-b">Agent B</label>
    <select id="agent-b">
      <option value="aggressive">Aggressive</option>
      <option value="heuristic">Heuristic</option>
      <option value="evader">Evader</option>
      <option value="dqn">DQN (TF.js)</option>
    </select>
  </div>

  <div class="row">
    <label for="agent-c">Agent C</label>
    <select id="agent-c">
      <option value="evader">Evader</option>
      <option value="aggressive">Aggressive</option>
      <option value="heuristic">Heuristic</option>
      <option value="dqn">DQN (TF.js)</option>
    </select>
  </div>

  <div class="row">
    <label for="agent-d">Agent D</label>
    <select id="agent-d">
      <option value="dqn">DQN (TF.js)</option>
      <option value="heuristic">Heuristic</option>
      <option value="aggressive">Aggressive</option>
      <option value="evader">Evader</option>
    </select>
  </div>

  <div class="row">
    <button id="start" class="primary">Start Match</button>
  </div>
  <div class="row">
    <button id="reset">Stop Match</button>
  </div>
`;

const seedInput = controls.querySelector("#seed");
const agentA = controls.querySelector("#agent-a");
const agentB = controls.querySelector("#agent-b");
const agentC = controls.querySelector("#agent-c");
const agentD = controls.querySelector("#agent-d");
const startButton = controls.querySelector("#start");
const resetButton = controls.querySelector("#reset");
let lastEvent = "booting";

if (
  !(seedInput instanceof HTMLInputElement) ||
  !(agentA instanceof HTMLSelectElement) ||
  !(agentB instanceof HTMLSelectElement) ||
  !(agentC instanceof HTMLSelectElement) ||
  !(agentD instanceof HTMLSelectElement) ||
  !(startButton instanceof HTMLButtonElement) ||
  !(resetButton instanceof HTMLButtonElement)
) {
  throw new Error("Missing control elements.");
}

const orchestrator = new GameOrchestrator(canvas, {
  onTick: (state) => {
    const jets = [...state.jets.values()];
    const alive = jets.filter((jet) => jet.alive).length;
    const moving = jets.filter((jet) => jet.alive && Math.hypot(jet.vx, jet.vy) > 0.2).length;
    status.textContent = `tick=${state.tick} alive=${alive} moving=${moving} bullets=${state.bullets.length} | ${lastEvent}`;

    const statCards = jets
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((jet) => {
        const speed = Math.hypot(jet.vx, jet.vy);
        const hpPct = Math.max(0, Math.min(100, (jet.health / 100) * 100));
        const fuelPct = Math.max(0, Math.min(100, (jet.fuel / 1000) * 100));
        const ammoPct = Math.max(0, Math.min(100, (jet.ammo / 50) * 100));
        const accent = colorForJet(jet.id);

        return `
          <article class="jet-card ${jet.alive ? "alive" : "down"}" style="--accent:${accent}">
            <header>
              <span class="jet-id">${jet.id}</span>
              <span class="jet-state">${jet.alive ? "ONLINE" : "DOWN"}</span>
            </header>
            <div class="bar-row"><span>HP</span><div class="bar"><i style="width:${hpPct}%"></i></div><b>${Math.max(0, jet.health).toFixed(0)}</b></div>
            <div class="bar-row"><span>FUEL</span><div class="bar"><i style="width:${fuelPct}%"></i></div><b>${Math.max(0, jet.fuel).toFixed(0)}</b></div>
            <div class="bar-row"><span>AMMO</span><div class="bar"><i style="width:${ammoPct}%"></i></div><b>${Math.max(0, jet.ammo)}</b></div>
            <footer>SPD ${speed.toFixed(2)} | CD ${jet.cooldown}</footer>
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

const buildPlayers = (): Array<{ id: string; code: string }> => {
  const picks = [agentA.value, agentB.value, agentC.value, agentD.value] as AgentKey[];
  return picks.map((pick, index) => ({
    id: `jet-${index + 1}-${AGENT_REGISTRY[pick].label.toLowerCase()}`,
    code: AGENT_REGISTRY[pick].code,
  }));
};

const startMatch = async (): Promise<void> => {
  const seed = Number(seedInput.value);
  const normalizedSeed = Number.isFinite(seed) ? seed : 1337;
  const players = buildPlayers();
  await orchestrator.start(players, normalizedSeed);
};

startButton.addEventListener("click", () => {
  void startMatch();
});

resetButton.addEventListener("click", () => {
  orchestrator.stop();
  lastEvent = "stopped";
  status.textContent = "Match stopped.";
});

void registerServiceWorker();
void startMatch();
