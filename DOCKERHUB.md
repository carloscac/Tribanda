# Docker Hub — `carloscacua/tribanda`

Repositorio público sugerido: [hub.docker.com/r/carloscacua/tribanda](https://hub.docker.com/r/carloscacua/tribanda)

Crea el repositorio en Docker Hub con nombre **`tribanda`** (usuario `carloscacua`) si aún no existe.

## Texto corto (descripción del repo)

**TriBanda** — Torneos de carambola: inscripciones, grupos, repesca, cuadro de eliminación y mando en vivo. Next.js 15 + Prisma + **MySQL**.

## Publicar imagen (desde tu Mac)

```bash
cd web
docker login
chmod +x scripts/docker-publish.sh
./scripts/docker-publish.sh
```

Por defecto publica **`linux/amd64`** (servidores x86). Otra plataforma: `DOCKER_PLATFORM=linux/arm64 ./scripts/docker-publish.sh`

Etiqueta concreta:

```bash
./scripts/docker-publish.sh v0.1.0
```

Otra cuenta o nombre de imagen:

```bash
DOCKER_IMAGE=carloscacua/torneos ./scripts/docker-publish.sh
```

## Ejecutar desde Docker Hub (MySQL externo)

Crea antes la base y el usuario en MySQL (utf8mb4). Luego:

```bash
docker pull carloscacua/tribanda:latest

docker run -d --name tribanda -p 8080:8080 \
  -e DATABASE_URL="mysql://USER:PASS@HOST:3306/tribanda" \
  -e AUTH_SECRET="cambia-esto-por-un-secreto-largo" \
  -e AUTH_TRUST_HOST=true \
  carloscacua/tribanda:latest
```

Al arrancar, el contenedor ejecuta `prisma migrate deploy` contra esa base.

Detalle de despliegue en VPS: ver **`MYSQL.md`**.

## Con Compose (app + MySQL local)

Copia `.env.docker.example` a `.env`, define `AUTH_SECRET` y contraseñas MySQL, luego:

```bash
docker compose up -d --build
```

Abre [http://localhost:8080](http://localhost:8080).

## Variables

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | URL MySQL (`mysql://user:pass@host:3306/tribanda`) |
| `AUTH_SECRET` | Sí | Secreto de Auth.js (cadena aleatoria larga) |
| `AUTH_TRUST_HOST` | Recomendado | `true` detrás de proxy o IP pública |
| `BOOTSTRAP_ADMIN_EMAIL` | Sí* | Email del primer admin (*solo si aún no hay ningún `ADMIN`) |
| `BOOTSTRAP_ADMIN_PASSWORD` | Sí* | Contraseña (mín. 6 caracteres) |
| `BOOTSTRAP_ADMIN_NAME` | No | Nombre mostrado (default: Administrador) |
| `APP_URL` | Recomendada | URL pública para enlaces de olvido de contraseña |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Para recuperación | Envío del correo “olvidé mi contraseña” |

## Icono del repositorio

En Docker Hub → repositorio → **Settings** → sube un PNG (256×256) con el logo o una captura del panel del organizador.
