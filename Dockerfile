FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
ENV NODE_ENV=production
RUN bun run build

FROM oven/bun:1-alpine AS runner
WORKDIR /app

RUN apk add --no-cache bash mariadb-client

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder --chown=bun:bun /app/build ./build
COPY --from=builder --chown=bun:bun /app/package.json ./
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/drizzle ./drizzle
COPY --from=builder --chown=bun:bun /app/src/lib/server/db ./src/lib/server/db
COPY --from=builder --chown=bun:bun /app/scripts ./scripts

EXPOSE 3000
USER bun
CMD ["bash", "scripts/coolify-start.sh"]
