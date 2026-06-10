#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [[ ! -d node_modules ]]; then
  echo "Dependencies are missing. Run ./setup.sh first." >&2
  exit 1
fi

exec npm run build

