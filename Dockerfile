FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
ENV NODE_ENV=production
# Placeholders pour le build (pas de Postgres réel requis si la DB n’est pas sollicitée au build)
ENV POSTGRES_HOST=127.0.0.1
ENV POSTGRES_PORT=5432
ENV POSTGRES_DB=docker-build
ENV POSTGRES_USER=docker-build
ENV POSTGRES_PASSWORD=docker-build
ENV POSTGRES_SSL_MODE=disable
RUN bun run build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

EXPOSE 3000
USER node
CMD ["node", "build/index.js"]
