#!/usr/bin/env bash
# Publica la imagen en Docker Hub: https://hub.docker.com/r/carloscacua/tribanda
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${DOCKER_IMAGE:-carloscacua/tribanda}"
TAG="${1:-latest}"
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo "")"

PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
TAGS=(-t "${IMAGE}:${TAG}")
if [[ -n "$VERSION" && "$TAG" == "latest" ]]; then
  TAGS+=(-t "${IMAGE}:${VERSION}")
  echo "→ Etiquetas: ${IMAGE}:${TAG} y ${IMAGE}:${VERSION}"
else
  echo "→ Etiqueta: ${IMAGE}:${TAG}"
fi

echo "→ Construyendo y subiendo (${PLATFORM}) … requiere: docker login"
docker buildx build --platform "${PLATFORM}" "${TAGS[@]}" --push .

echo ""
echo "Listo. Ejemplo para correr:"
echo "  docker run -d -p 8080:8080 \\"
echo "    -e DATABASE_URL='mysql://user:pass@host:3306/tribanda' \\"
echo "    -e AUTH_SECRET='(cadena larga aleatoria)' \\"
echo "    -e AUTH_TRUST_HOST=true \\"
echo "    ${IMAGE}:${TAG}"
