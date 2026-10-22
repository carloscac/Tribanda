#!/usr/bin/env bash
# Crea el primer ADMIN si no existe (lee DATABASE_URL del .env y vars BOOTSTRAP_*).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  CURSOR_NODE="/Applications/Cursor.app/Contents/Resources/app/resources/helpers"
  [[ -x "${CURSOR_NODE}/node" ]] && export PATH="${CURSOR_NODE}:${PATH}"
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

exec node scripts/bootstrap-admin.mjs
