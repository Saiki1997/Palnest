#!/bin/sh
set -eu
cd /workspace
# Prefer the C# host. Free 8080 if the old Node preview is still bound.
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  if curl -sf --max-time 2 http://127.0.0.1:8080/ | grep -q "Create new server"; then
    exit 0
  fi
fi
export DOTNET_ROOT=/workspace/.dotnet
export DOTNET_CLI_HOME=/workspace/.dotnet-home
export DOTNET_NOLOGO=1
export PATH="$DOTNET_ROOT:$PATH"
export ASPNETCORE_URLS=http://0.0.0.0:8080
node scripts/preview.mjs stop || true
"$DOTNET_ROOT/dotnet" run --project Palnest.App --no-launch-profile --urls http://0.0.0.0:8080 >>/tmp/app-startup.log 2>&1 &
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
    exit 0
  fi
  sleep 1
done
exit 0
