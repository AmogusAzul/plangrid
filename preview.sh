#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [[ ! -d node_modules ]]; then
  echo "Dependencies are missing. Run ./setup.sh first." >&2
  exit 1
fi

if [[ ! -d dist ]]; then
  echo "Production build is missing. Running ./build.sh..."
  "$PROJECT_DIR/build.sh"
fi

exec npm run preview -- --host "${HOST:-127.0.0.1}" --port "${PORT:-4173}"

