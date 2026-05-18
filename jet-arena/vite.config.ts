import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function neonAuthConnectSrcOrigins(env: Record<string, string>): string {
  const raw = env.VITE_NEON_AUTH_URL?.trim();
  if (!raw.length) {
    return "";
  }
  try {
    return ` ${new URL(raw).origin}`;
  } catch {
    return "";
  }
}

const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:4000";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const extraConnectSrc = neonAuthConnectSrcOrigins(env);

  return {
    plugins: [
      {
        name: "inject-neon-auth-csp-connect-src",
        transformIndexHtml(html) {
          return html.replaceAll("__VITE_EXTRA_CONNECT_SRC__", extraConnectSrc);
        },
      },
      react(),
      tailwindcss(),
    ],
    server: {
      port: 5174,
      proxy: {
        "/fighters": { target: API_TARGET, changeOrigin: true },
        "/assets": { target: API_TARGET, changeOrigin: true },
        // Do not proxy `/agents/*` broadly: Vite serves `jet-arena/agents/**` as module URLs (e.g. .../agent.ts?raw).
        // API only exposes POST /agents/:id/package (see api/src/routes/storage/index.ts).
        "^/agents/[^/]+/package": { target: API_TARGET, changeOrigin: true },
        "/pipeline": { target: API_TARGET, changeOrigin: true },
        "/generate": { target: API_TARGET, changeOrigin: true },
        "/health": { target: API_TARGET, changeOrigin: true },
        "/ws": { target: API_TARGET, ws: true, changeOrigin: true },
      },
    },
  };
});
