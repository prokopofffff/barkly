#!/usr/bin/env bash
# One command to run the full local backend for on-device testing:
#   Postgres + zero-cache in docker, the API on the host (hot-reload).
#
# Usage (from repo root):  bun run backend
# Stop:                    bun run backend:down   (or Ctrl-C stops just the API)
set -euo pipefail
cd "$(dirname "$0")/.." # -> apps/server

# Host ports chosen to avoid clashing with other local stacks (5432/5433/4848
# are commonly taken). Override by exporting PG_PORT / ZERO_PORT.
export PG_PORT="${PG_PORT:-5434}"
export ZERO_PORT="${ZERO_PORT:-4849}"
API_PORT="${PORT:-3000}"

# The phone reaches the Mac by its LAN IP, which changes with the network
# (Wi-Fi vs iPhone hotspot, DHCP renew, …). Detect it and keep apps/mobile/.env
# in sync so on-device testing "just works" without hand-editing the IP.
detect_lan_ip() {
  local ip ifc
  ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
  if [ -z "$ip" ]; then
    ifc="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')"
    [ -n "$ifc" ] && ip="$(ipconfig getifaddr "$ifc" 2>/dev/null || true)"
  fi
  printf '%s' "$ip"
}
LAN_IP="$(detect_lan_ip)"
MOBILE_ENV="../mobile/.env"
if [ -n "$LAN_IP" ] && [ -f "$MOBILE_ENV" ]; then
  sed -i '' -E "s#^EXPO_PUBLIC_API_URL=.*#EXPO_PUBLIC_API_URL=http://${LAN_IP}:${API_PORT}#" "$MOBILE_ENV"
  sed -i '' -E "s#^EXPO_PUBLIC_ZERO_SERVER=.*#EXPO_PUBLIC_ZERO_SERVER=http://${LAN_IP}:${ZERO_PORT}#" "$MOBILE_ENV"
  echo "▶ LAN IP = ${LAN_IP}  →  wrote API + zero URLs into apps/mobile/.env"
  echo "  (restart Metro with -c so the phone picks up the new URLs)"
else
  echo "▶ WARN: could not detect a LAN IP — set EXPO_PUBLIC_* in apps/mobile/.env by hand"
fi

echo "▶ Postgres + zero-cache (docker)…"
docker compose up -d postgres zero-cache

echo "▶ waiting for Postgres to be healthy…"
pg_id="$(docker compose ps -q postgres)"
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$pg_id" 2>/dev/null)" = "healthy" ]; do
  sleep 1
done

echo "▶ applying migrations (idempotent)…"
bun run db:migrate

echo "▶ API on http://0.0.0.0:${PORT:-3000}  (reachable from the phone over Wi-Fi)"
echo "  Ctrl-C stops the API; docker (pg + zero-cache) keeps running."
exec bun run dev
