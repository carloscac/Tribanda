#!/usr/bin/env bash
# Turbopack/PostCSS lanza procesos `node`; debe estar en PATH (p. ej. Node de Cursor o Homebrew).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  CURSOR_NODE="/Applications/Cursor.app/Contents/Resources/app/resources/helpers"
  if [[ -x "${CURSOR_NODE}/node" ]]; then
    export PATH="${CURSOR_NODE}:${PATH}"
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "No se encontró node en PATH. Instala Node (brew install node) o ejecuta desde Cursor." >&2
  exit 1
fi

node node_modules/prisma/build/index.js generate
exec node node_modules/next/dist/bin/next dev --turbopack -p "${PORT:-8080}"
