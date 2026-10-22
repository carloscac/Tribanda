# App web — Torneos de carambola

Next.js + Auth.js + Prisma (**MySQL**). Documentación de producto en la carpeta padre.

## Arrancar

Copia `.env.example` a `.env` (o usa el `.env` ya configurado para MySQL).

```bash
cd web
npm install
npm run db:local    # Docker MySQL + migraciones
npm run dev
```

Abre [http://localhost:8080](http://localhost:8080). Crea una cuenta de organizador.

Guía MySQL (VPS, compose, variables): [MYSQL.md](./MYSQL.md).

## Docker Hub

Imagen pública: **`carloscacua/tribanda`**.

```bash
docker login
./scripts/docker-publish.sh
```

Instrucciones completas (crear repo, variables, `docker run`): [DOCKERHUB.md](./DOCKERHUB.md).
