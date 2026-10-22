#!/bin/sh
set -e

# Quitar comillas que a veces copia el .env del host
DATABASE_URL=$(printf '%s' "$DATABASE_URL" | sed -e 's/^["'\''"]//' -e 's/["'\''"]$//')

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: Define DATABASE_URL (MySQL), p. ej. mysql://user:pass@host:3306/tribanda" >&2
  exit 1
fi

case "$DATABASE_URL" in
  mysql://*) ;;
  file:*)
    echo "ERROR: DATABASE_URL es SQLite ($DATABASE_URL). TriBanda ya usa MySQL." >&2
    echo "  En DevOps/.env usa: DATABASE_URL=mysql://user:pass@HOST:3306/tribanda" >&2
    echo "  Quita volúmenes DatosSqlLite y DATABASE_URL=file:..." >&2
    exit 1
    ;;
  *)
    echo "ERROR: DATABASE_URL debe empezar por mysql:// (recibido: ${DATABASE_URL%%@*}@…)." >&2
    exit 1
    ;;
esac

if [ -z "$AUTH_SECRET" ]; then
  echo "ERROR: Define AUTH_SECRET (cadena larga aleatoria) al publicar." >&2
  exit 1
fi

echo "Aplicando migraciones de base de datos…"
runuser -u nextjs -- env DATABASE_URL="$DATABASE_URL" prisma migrate deploy --schema=./prisma/schema.prisma

echo "Comprobando administrador inicial…"
runuser -u nextjs -- env \
  DATABASE_URL="$DATABASE_URL" \
  BOOTSTRAP_ADMIN_EMAIL="$BOOTSTRAP_ADMIN_EMAIL" \
  BOOTSTRAP_ADMIN_PASSWORD="$BOOTSTRAP_ADMIN_PASSWORD" \
  BOOTSTRAP_ADMIN_NAME="$BOOTSTRAP_ADMIN_NAME" \
  node ./scripts/bootstrap-admin.mjs

echo "Iniciando TriBanda…"
exec runuser -u nextjs -- env DATABASE_URL="$DATABASE_URL" AUTH_SECRET="$AUTH_SECRET" AUTH_TRUST_HOST="${AUTH_TRUST_HOST:-true}" node server.js
