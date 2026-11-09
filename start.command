#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if [ ! -d node_modules ]; then npm install || exit 1; fi
npm run dev &
server_pid=$!
for attempt in {1..50}; do
  if curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; then break; fi
  sleep 0.1
done
open http://127.0.0.1:5173/
wait "$server_pid"
