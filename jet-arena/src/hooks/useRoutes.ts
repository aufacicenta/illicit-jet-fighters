import { resolveApiBase } from "../config/apiBase";

const envApiBase = resolveApiBase({
  apiBase: import.meta.env.VITE_API_URL,
  isDev: import.meta.env.DEV,
});

/** In dev without VITE_API_URL, call the API on :4000 directly (matches API default PORT); override with VITE_API_URL otherwise. */
export const API_BASE = envApiBase;

const resolveWsBase = (): string => {
  if (envApiBase.length > 0) {
    return envApiBase.replace(/^http/, "ws").replace(/\/+$/, "");
  }
  if (import.meta.env.DEV) {
    return "ws://localhost:4000";
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
  }
  return "ws://localhost:4000";
};

const WS_BASE = resolveWsBase();

export const routes = {
  broadcast: (id: string) => `/broadcast/${id}`,
  /** Opens the create-fighter flow and provisions a fresh fighter record. */
  createFighter: () => `/fighters/new`,
  createBattlefield: () => `/battlefields/new`,
  fighterWizard: (id: string) => `/wizard/fighter/${id}`,
  battlefieldWizard: (id: string) => `/wizard/battlefield/${id}`,
  terminalFighters: () => `/terminal/fighters`,
  terminalWallet: () => `/terminal/wallet`,
  /** Deprecated singular route kept only for backward-compatible redirects. */
  terminalSimulation: () => `/terminal/simulation`,
  login: () => `/login`,
  signup: () => `/signup`,
};

export const apiRoutes = {
  fighters: `${API_BASE}/fighters`,
  fighter: (id: number) => `${API_BASE}/fighters/${encodeURIComponent(String(id))}`,
  battlefields: `${API_BASE}/battlefields`,
  battlefieldSession: `${API_BASE}/battlefields/session`,
  fighterAgentVersions: (id: number) =>
    `${API_BASE}/fighters/${encodeURIComponent(String(id))}/agent-versions`,
  fighterSession: `${API_BASE}/fighters/session`,
  simulations: `${API_BASE}/simulations`,
  simulationStatus: (id: string) => `${API_BASE}/simulations/${encodeURIComponent(id)}/status`,
  simulationReplay: (id: string) => `${API_BASE}/simulations/${encodeURIComponent(id)}/replay`,
  pipelineStart: `${API_BASE}/pipeline/start`,
  pipelineSpecsheet: `${API_BASE}/pipeline/specsheet`,
  pipelineAgentCode: `${API_BASE}/pipeline/agent-code`,
  pipelineSpritesheetImage: `${API_BASE}/pipeline/spritesheet-image`,
  pipelineStrikecraftSpecsheetImage: `${API_BASE}/pipeline/strikecraft-specsheet-image`,
  pipelineStrikecraftSpriteImage: `${API_BASE}/pipeline/strikecraft-sprite-image`,
  pipelineState: (fighterId: string) =>
    `${API_BASE}/pipeline/${encodeURIComponent(fighterId)}/state`,
  battlefieldPipelineStart: `${API_BASE}/battlefield-pipeline/start`,
  battlefieldPipelineSheet: `${API_BASE}/battlefield-pipeline/sheet`,
  battlefieldPipelineConfig: `${API_BASE}/battlefield-pipeline/config`,
  battlefieldPipelineState: (battlefieldId: string) =>
    `${API_BASE}/battlefield-pipeline/${encodeURIComponent(battlefieldId)}/state`,
  fighterCosts: (fighterId: string) => `${API_BASE}/costs/fighter/${encodeURIComponent(fighterId)}`,
  battlefieldCosts: (battlefieldId: string) =>
    `${API_BASE}/costs/battlefield/${encodeURIComponent(battlefieldId)}`,
  generateCharacterDescription: `${API_BASE}/generate/character-description`,
  refineCharacterDescription: `${API_BASE}/generate/character-description/refine`,
  generateSpecsheetPrompt: `${API_BASE}/generate/specsheet-prompt`,
  refineSpecsheetPrompt: `${API_BASE}/generate/specsheet-prompt/refine`,
  generateSpecsheetImage: `${API_BASE}/generate/specsheet-image`,
  refineSpecsheetImage: `${API_BASE}/generate/specsheet-image/refine`,
  walletMe: `${API_BASE}/wallet/me`,
  walletLedger: `${API_BASE}/wallet/me/ledger`,
  walletWithdrawals: `${API_BASE}/wallet/me/withdrawals`,
  walletCancelWithdrawal: (groupId: string) =>
    `${API_BASE}/wallet/me/withdrawals/${encodeURIComponent(groupId)}/cancel`,
};

export const wsRoutes = {
  fighter: (id: string) => `${WS_BASE}/ws/${id}`,
  battlefield: (id: string) => `${WS_BASE}/ws/battlefield/${id}`,
  user: () => `${WS_BASE}/ws/user`,
  broadcast: (id: string) => `${WS_BASE}/broadcast/${id}`,
};

export const useRoutes = () => ({ routes, apiRoutes, wsRoutes });
