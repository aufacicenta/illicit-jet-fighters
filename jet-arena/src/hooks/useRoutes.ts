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
  return "";
};

const WS_BASE = resolveWsBase();

export const TERMINAL_TAB_QUERY_KEY = "tab" as const;

export const terminalTabValues = [
  "my-fighters",
  "my-battlefields",
  "my-simulations",
  "arena",
] as const;

export type TerminalTab = (typeof terminalTabValues)[number];

export const isTerminalTab = (value: string | null): value is TerminalTab =>
  value !== null && (terminalTabValues as readonly string[]).includes(value);

export const routes = {
  home: () => "/",
  broadcast: (id: string) => `/broadcast/${id}`,
  /** Opens the create-fighter flow and provisions a fresh fighter record. */
  createFighter: () => `/fighters/new`,
  createBattlefield: () => `/battlefields/new`,
  fighterWizard: (id: string) => `/wizard/fighter/${id}`,
  battlefieldWizard: (id: string) => `/wizard/battlefield/${id}`,
  terminalFighters: (tab?: TerminalTab) => {
    const path = `/terminal/fighters`;
    return tab ? `${path}?${TERMINAL_TAB_QUERY_KEY}=${encodeURIComponent(tab)}` : path;
  },
  terminalFighterBalance: (fighterId: string) => `/terminal/fighters/${fighterId}/balance`,
  terminalWallet: () => `/terminal/wallet`,
  /** Deprecated singular route kept only for backward-compatible redirects. */
  terminalSimulation: () => `/terminal/simulation`,
  login: () => `/login`,
  signup: () => `/signup`,
};

export const apiRoutes = {
  publicFighters: `${API_BASE}/public/fighters`,
  publicFighter: (id: number) => `${API_BASE}/public/fighters/${encodeURIComponent(String(id))}`,
  fighters: `${API_BASE}/fighters`,
  fighter: (id: number) => `${API_BASE}/fighters/${encodeURIComponent(String(id))}`,
  battlefields: `${API_BASE}/battlefields`,
  battlefield: (id: number) => `${API_BASE}/battlefields/${encodeURIComponent(String(id))}`,
  battlefieldSession: `${API_BASE}/battlefields/session`,
  fighterAgentVersions: (id: number) =>
    `${API_BASE}/fighters/${encodeURIComponent(String(id))}/agent-versions`,
  fighterCheckpoint: (id: number, simulationId?: string) => {
    const base = `${API_BASE}/fighters/${encodeURIComponent(String(id))}/checkpoint`;
    return simulationId ? `${base}?simulationId=${encodeURIComponent(simulationId)}` : base;
  },
  fighterIntake: `${API_BASE}/fighters/intake`,
  arenaPools: `${API_BASE}/arena/pools`,
  arenaPool: (poolId: string) => `${API_BASE}/arena/pools/${encodeURIComponent(poolId)}`,
  arenaPoolEnter: (poolId: string) => `${API_BASE}/arena/pools/${encodeURIComponent(poolId)}/enter`,
  arenaPoolLeave: (poolId: string) => `${API_BASE}/arena/pools/${encodeURIComponent(poolId)}/leave`,
  arenaMyQueue: `${API_BASE}/arena/me/queue`,
  arenaMyActive: `${API_BASE}/arena/me/active`,
  simulations: `${API_BASE}/simulations`,
  simulationStatus: (id: string) => `${API_BASE}/simulations/${encodeURIComponent(id)}/status`,
  simulationReplay: (id: string) => `${API_BASE}/simulations/${encodeURIComponent(id)}/replay`,
  pipelineStart: `${API_BASE}/pipeline/start`,
  pipelineSpecsheet: `${API_BASE}/pipeline/specsheet`,
  pipelineCharacterPfp: `${API_BASE}/pipeline/character-pfp`,
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
  walletPreflight: (sectionId: string) =>
    `${API_BASE}/wallet/me/preflight?sectionId=${encodeURIComponent(sectionId)}`,
  walletLedger: `${API_BASE}/wallet/me/ledger`,
  walletFighterLedger: (fighterId: string) =>
    `${API_BASE}/wallet/me/fighters/${encodeURIComponent(fighterId)}/ledger`,
  walletFighterTransferIn: (fighterId: string) =>
    `${API_BASE}/wallet/me/fighters/${encodeURIComponent(fighterId)}/transfer-in`,
  walletFighterTransferOut: (fighterId: string) =>
    `${API_BASE}/wallet/me/fighters/${encodeURIComponent(fighterId)}/transfer-out`,
  walletFighterArenaUnlock: (fighterId: string) =>
    `${API_BASE}/wallet/me/fighters/${encodeURIComponent(fighterId)}/unlock`,
  walletFighterSettlement: `${API_BASE}/wallet/me/fighters/settlement`,
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
