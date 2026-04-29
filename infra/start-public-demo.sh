#!/usr/bin/env bash
# Start full public demo: prod build, prod server, cloudflared tunnel, caffeinate.
set -e
cd "$(dirname "$0")/../packages/dashboard"

# Read tunnel token from secret file (NOT committed)
TOKEN_FILE="/tmp/.tunnel-token"
if [ ! -f "$TOKEN_FILE" ]; then
  echo "✗ /tmp/.tunnel-token missing. Save the cloudflare token there first."
  exit 1
fi

# Build (skip if .next/standalone exists — already built)
if [ ! -d ".next" ]; then
  echo "Building production..."
  pnpm build
fi

# Kill old processes
pkill -f "next-server" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
pkill -f "caffeinate" 2>/dev/null
sleep 2

# Start production server
PORT=3000 nohup pnpm start > /tmp/dev.log 2>&1 &
echo "Production server PID: $!"

# Cloudflared tunnel
nohup cloudflared tunnel run --token "$(cat $TOKEN_FILE)" > /tmp/cf-tunnel.log 2>&1 &
echo "Cloudflared PID: $!"

# Keep Mac awake
nohup caffeinate -d -i -s > /tmp/caffeinate.log 2>&1 &
echo "caffeinate PID: $!"

sleep 6
echo
echo "=== Smoke ==="
curl -sL -o /dev/null -w "https://ailab.21cloud.uz/: HTTP %{http_code}\n" https://ailab.21cloud.uz/
echo "Demo ready — open https://ailab.21cloud.uz from any device"
