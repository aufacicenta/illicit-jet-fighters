import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { resolveApiProxyTarget } from "./src/config/apiBase";

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

function extraImgSrcOrigins(env: Record<string, string>): string {
  const values = [env.VITE_R2_ENDPOINT, env.VITE_IMAGE_CDN_URL]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);
  const origins = values.flatMap((value) => {
    try {
      return [new URL(value).origin];
    } catch {
      return [];
    }
  });
  const uniqueOrigins = Array.from(new Set(origins));
  const cloudflareWildcard = "https://*.r2.cloudflarestorage.com";
  return [cloudflareWildcard, ...uniqueOrigins].join(" ");
}

function extraConnectSrcOrigins(env: Record<string, string>): string {
  const values = [env.VITE_R2_ENDPOINT, env.VITE_IMAGE_CDN_URL]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);
  const origins = values.flatMap((value) => {
    try {
      return [new URL(value).origin];
    } catch {
      return [];
    }
  });
  const uniqueOrigins = Array.from(new Set(origins));
  const cloudflareWildcard = "https://*.r2.cloudflarestorage.com";
  return [cloudflareWildcard, ...uniqueOrigins].join(" ");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const apiTarget = resolveApiProxyTarget(env.VITE_API_PROXY_TARGET ?? env.VITE_API_URL);
  const neonConnectSrc = neonAuthConnectSrcOrigins(env);
  const imgSrcSubstitution = extraImgSrcOrigins(env);
  const extraConnectSrc = extraConnectSrcOrigins(env);
  const devApiConnectSrc =
    mode === "development"
      ? " http://localhost:4000 ws://localhost:4000 http://127.0.0.1:4000 ws://127.0.0.1:4000"
      : "";
  const connectSrcSubstitution = `${neonConnectSrc ? `${neonConnectSrc} ` : ""}${extraConnectSrc}${devApiConnectSrc}`;

  return {
    plugins: [
      {
        name: "inject-csp-connect-src",
        transformIndexHtml(html) {
          return html
            .replaceAll("__VITE_EXTRA_CONNECT_SRC__", connectSrcSubstitution)
            .replaceAll("__VITE_EXTRA_IMG_SRC__", imgSrcSubstitution);
        },
      },
      react(),
      tailwindcss(),
    ],
    server: {
      port: 5174,
      proxy: {
        // Only proxy the REST handler; SPA route `/fighters/new` must not hit the API.
        "/fighters/session": { target: apiTarget, changeOrigin: true },
        "/assets": { target: apiTarget, changeOrigin: true },
        // Do not proxy `/agents/*` broadly: Vite serves `jet-arena/agents/**` as module URLs (e.g. .../agent.ts?raw).
        // API only exposes POST /agents/:id/package (see api/src/routes/storage/index.ts).
        "^/agents/[^/]+/package": { target: apiTarget, changeOrigin: true },
        "/pipeline": { target: apiTarget, changeOrigin: true },
        "/generate": { target: apiTarget, changeOrigin: true },
        "/health": { target: apiTarget, changeOrigin: true },
        "/ws": { target: apiTarget, ws: true, changeOrigin: true },
      },
    },
  };
});
