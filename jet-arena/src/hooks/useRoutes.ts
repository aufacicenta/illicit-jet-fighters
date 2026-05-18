/** Same-origin in dev (Vite proxy); override with VITE_API_URL for direct API access. */
export const API_BASE = import.meta.env.VITE_API_URL ?? "";

const resolveWsBase = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/^http/, "ws");
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
  fighterWizard: (id: string) => `/wizard/fighter/${id}`,
  login: () => `/login`,
  signup: () => `/signup`,
};

export const apiRoutes = {
  fighterSession: `${API_BASE}/fighters/session`,
  pipelineStart: `${API_BASE}/pipeline/start`,
  pipelineSpecsheet: `${API_BASE}/pipeline/specsheet`,
  pipelineState: (fighterId: string) =>
    `${API_BASE}/pipeline/${encodeURIComponent(fighterId)}/state`,
  generateCharacterDescription: `${API_BASE}/generate/character-description`,
  refineCharacterDescription: `${API_BASE}/generate/character-description/refine`,
  generateSpecsheetPrompt: `${API_BASE}/generate/specsheet-prompt`,
  refineSpecsheetPrompt: `${API_BASE}/generate/specsheet-prompt/refine`,
  generateSpecsheetImage: `${API_BASE}/generate/specsheet-image`,
  refineSpecsheetImage: `${API_BASE}/generate/specsheet-image/refine`,
};

export const wsRoutes = {
  fighter: (id: string) => `${WS_BASE}/ws/${id}`,
};

export const useRoutes = () => ({ routes, apiRoutes, wsRoutes });
