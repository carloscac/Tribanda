#!/usr/bin/env bash
# MySQL local para pruebas: docker compose (db) + migraciones Prisma.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  CURSOR_NODE="/Applications/Cursor.app/Contents/Resources/app/resources/helpers"
  if [[ -x "${CURSOR_NODE}/node" ]]; then
    export PATH="${CURSOR_NODE}:${PATH}"
  fi
fi

if [[ ! -f .env ]]; then
  echo "Copia .env.example a .env y ajusta contraseñas si hace falta." >&2
  exit 1
fi

echo "→ Levantando MySQL (docker compose)…"
docker compose up -d db

ROOT_PASS="${MYSQL_ROOT_PASSWORD:-changeme-root}"
echo "→ Esperando MySQL…"
for _ in $(seq 1 30); do
  if docker compose exec -T db mysqladmin ping -h 127.0.0.1 -uroot -p"${ROOT_PASS}" 2>/dev/null | grep -q alive; then
    break
  fi
  sleep 2
done

node node_modules/prisma/build/index.js generate
node node_modules/prisma/build/index.js migrate deploy

echo ""
echo "Listo. Arranca la app: npm run dev"
echo "  (MySQL en 127.0.0.1:3306, base tribanda)"
