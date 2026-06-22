export const config = {
  neonAuthUrl: import.meta.env.VITE_NEON_AUTH_URL?.trim() ?? "",
  siteUrl: (import.meta.env.VITE_SITE_URL?.trim() || "https://illicitjetfighters.com").replace(
    /\/$/,
    "",
  ),
} as const;
