# MySQL — desarrollo y producción

TriBanda usa **MySQL 8** (utf8mb4). Prisma aplica el esquema con `prisma migrate deploy` al iniciar el contenedor.

## Desarrollo local

1. Levanta MySQL y la app:

   ```bash
   cd web
   cp .env.docker.example .env
   # edita AUTH_SECRET y contraseñas
   docker compose up -d
   ```

2. O MySQL ya instalado en el Mac:

   ```sql
   CREATE DATABASE tribanda CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'tribanda'@'%' IDENTIFIED BY 'tu-password';
   GRANT ALL ON tribanda.* TO 'tribanda'@'%';
   FLUSH PRIVILEGES;
   ```

   En `.env`:

   ```env
   DATABASE_URL="mysql://tribanda:tu-password@127.0.0.1:3306/tribanda"
   ```

3. Migraciones:

   ```bash
   npm run db:migrate   # desarrollo
   # producción / Docker: migrate deploy (automático en entrypoint)
   ```

## VPS (Grupo Único / stack con nginx-proxy)

En el servicio **Tribanda** del compose de DevOps:

1. **Quitar** el volumen de SQLite (`/GrupoUnico/DatosSqlLite:/data`) — ya no se usa.
2. **MySQL en el mismo VPS** (host `154.53.35.9`, puerto `3306`): desde el contenedor TriBanda suele funcionar la IP del host o el nombre del servicio MySQL en compose (p. ej. `mysql` o `db`), no `127.0.0.1`.
3. **Variables de entorno** — dos formas válidas:

   **A) Sin archivo `.env`** (todo en el `docker-compose.yml`): pon la URL **literal** en `environment`. `${DATABASE_URL}` solo sirve si existe `.env` junto al compose o exportaste la variable en la shell antes de `docker compose up`.

   ```yaml
   environment:
     DATABASE_URL: "mysql://root:CONTRASEÑA_URL_ENCODED@154.53.35.9:3306/tribanda"
     AUTH_SECRET: "tu-secreto-largo"
     AUTH_TRUST_HOST: "true"
     BOOTSTRAP_ADMIN_EMAIL: "ingcarloscacua@gmail.com"
     BOOTSTRAP_ADMIN_PASSWORD: "tu-contraseña"
     BOOTSTRAP_ADMIN_NAME: "Carlos"
   ```

   Ejemplo completo (Grupo Único, nginx-proxy, **sin `.env`**): `docker-compose.vps.example.yml`.

   **Comillas:** en forma `- KEY=valor` no pongas comillas alrededor del valor (`AUTH_SECRET="x"` hace que Auth.js reciba `"x"` con comillas). Usa `- AUTH_SECRET=x`.

   **Puerto:** TriBanda escucha **8080** → `VIRTUAL_PORT=8080` y `expose: ["8080"]`, no 80.

   **B) Con `.env`** en la misma carpeta que el compose (opcional):

   ```env
   DATABASE_URL=mysql://root:CONTRASEÑA_URL_ENCODED@154.53.35.9:3306/tribanda
   ```

   ```yaml
   environment:
     DATABASE_URL: ${DATABASE_URL}
   ```

   Contraseña con `*`, `!`, etc.: codifica en la URL (`*` → `%2A`, `!` → `%21`).

   Quita cualquier `DATABASE_URL: file:/data/...` o volumen `DatosSqlLite`.

4. Recrea el contenedor:

   ```bash
   docker compose up -d --force-recreate Tribanda
   ```

5. Revisa logs:

   ```bash
   docker logs container-pagina-tribanda
   ```

   Debe verse «Aplicando migraciones…» sin error SQL.

### Primera base vacía

Si la base `tribanda` no existe, créala en MySQL antes del primer arranque (mismo charset utf8mb4).

El entrypoint puede crear el usuario admin si defines `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` y aún no hay rol `ADMIN`.

## Datos que estaban en SQLite

Las migraciones antiguas de SQLite están en `prisma/migrations_sqlite/` (solo referencia). **No** se importan solas.

Opciones:

- **Empezar de cero** en MySQL (torneos nuevos) — lo habitual al cambiar en producción.
- **Copiar datos**: exportar tablas desde `tribanda.db` e importar a MySQL (orden respetando FKs), o un script one-off con Prisma leyendo SQLite y escribiendo MySQL. Si necesitas migrar un torneo concreto en producción, conviene planearlo aparte.

## URL con caracteres especiales en la contraseña

Codifica `@`, `#`, `%`, etc. en la contraseña (URL encode) dentro de `DATABASE_URL`.

## Error «the URL must start with the protocol mysql://»

El contenedor tiene un `DATABASE_URL` **viejo de SQLite** o mal escrito.

En el VPS:

```bash
cd /GrupoUnico/DevOps
grep DATABASE_URL .env docker-compose.yml docker-compose.yaml 2>/dev/null
docker inspect container-pagina-tribanda --format '{{range .Config.Env}}{{println .}}{{end}}' | grep DATABASE
```

Corrección en **`.env`** (sin comillas en el compose, o con comillas consistentes):

```env
DATABASE_URL=mysql://root:CONTRASEÑA_URL_ENCODED@154.53.35.9:3306/tribanda
```

En el **servicio Tribanda**, debe llegar al contenedor (no dejes `file:/data/...`):

```yaml
environment:
  DATABASE_URL: ${DATABASE_URL}
```

Luego: `docker compose up -d --force-recreate` y revisa logs.
