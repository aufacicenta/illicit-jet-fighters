export const config = {
  neonAuthUrl: import.meta.env.VITE_NEON_AUTH_URL?.trim() ?? "",
} as const;
