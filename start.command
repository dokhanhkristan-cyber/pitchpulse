#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Chua cai Node.js. Vao https://nodejs.org de cai Node.js (ban LTS).'
  read -r -p 'Press Enter to exit...'
  exit 1
fi
echo 'PITCH PULSE dang chay tai http://localhost:3000'
node server.js
