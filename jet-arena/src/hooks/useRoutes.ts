export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export const routes = {
  broadcast: (id: string) => `/broadcast/${id}`,
  fighterWizard: (id: string) => `/wizard/fighter/${id}`,
};

export const apiRoutes = {
  pipelineStart: `${API_BASE}/pipeline/start`,
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
