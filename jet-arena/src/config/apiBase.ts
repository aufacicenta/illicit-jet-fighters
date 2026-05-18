const DEFAULT_DEV_API_BASE = "http://localhost:4000";

const normalizeApiBase = (value: string | undefined): string => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.replace(/\/+$/, "") : "";
};

type ResolveApiBaseOptions = {
  apiBase: string | undefined;
  isDev: boolean;
};

/**
 * Uses explicit env config when provided, otherwise falls back to localhost in dev.
 */
export const resolveApiBase = ({ apiBase, isDev }: ResolveApiBaseOptions): string => {
  const normalizedApiBase = normalizeApiBase(apiBase);
  if (normalizedApiBase.length > 0) {
    return normalizedApiBase;
  }

  return isDev ? DEFAULT_DEV_API_BASE : "";
};

export const resolveApiProxyTarget = (apiBase: string | undefined): string => {
  const normalizedApiBase = normalizeApiBase(apiBase);
  return normalizedApiBase.length > 0 ? normalizedApiBase : DEFAULT_DEV_API_BASE;
};
