#!/usr/bin/env bash
#
# Run the full local dev stack: jet-arena (frontend), api, and wallet-indexer.
# Ports are picked up automatically from CONDUCTOR_PORT (falls back to 5174),
# so multiple Conductor workspaces can run side by side without colliding.
#
#   CONDUCTOR_PORT     -> jet-arena (Vite)
#   CONDUCTOR_PORT + 1 -> api (Elysia, via PORT env)
#   wallet-indexer has no server port.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BASE_PORT="${CONDUCTOR_PORT:-5174}"
ARENA_PORT="$BASE_PORT"
API_PORT="$((BASE_PORT + 1))"

# Dependencies are installed by the Conductor setup script (`bun install` at the
# repo root, which resolves the whole monorepo), so we don't install here.

# Point the api at its port and tell the frontend's dev proxy where to find it.
export PORT="$API_PORT"
export VITE_API_PROXY_TARGET="http://localhost:$API_PORT"
export VITE_API_URL="http://localhost:$API_PORT"

# The frontend calls the api directly (cross-origin), so allow its origin in CORS.
export CORS_ORIGIN="http://localhost:$ARENA_PORT"

# Track child PIDs and tear the whole stack down together on exit.
pids=()
cleanup() {
  trap - INT TERM EXIT
  kill "${pids[@]}" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "==> Starting api on :$API_PORT"
bun run --filter '@ijf/api' dev &
pids+=($!)

echo "==> Starting wallet-indexer"
bun run --filter '@ijf/wallet-indexer' dev &
pids+=($!)

echo "==> Starting jet-arena on :$ARENA_PORT"
bun run --filter 'illicit-jet-fighters' dev -- --port "$ARENA_PORT" &
pids+=($!)

# Poll until any process exits, then let the trap tear the rest down.
# (`wait -n` isn't available in macOS's bundled bash 3.2.)
while kill -0 "${pids[@]}" 2>/dev/null; do
  sleep 1
done
