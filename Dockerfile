# TriBanda — imagen de producción (Next.js + Prisma/MySQL)
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Sin schema aún: evitar postinstall (prisma generate) en esta capa
RUN npm ci --ignore-scripts --legacy-peer-deps

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npx next build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=8080

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g prisma@6.16.3

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Cliente Prisma generado + migraciones (el CLI va global; ver npm install -g arriba).
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder /app/node_modules/nodemailer ./node_modules/nodemailer

COPY scripts/bootstrap-admin.mjs ./scripts/bootstrap-admin.mjs
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/docker-entrypoint.sh"]
