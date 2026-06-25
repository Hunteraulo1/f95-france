FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
ENV NODE_ENV=production
RUN bun run build

FROM oven/bun:1-alpine AS runner
WORKDIR /app

RUN apk add --no-cache bash mariadb-client wget && chown bun:bun /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --chown=bun:bun package.json bun.lock ./

USER bun
RUN bun install --production --frozen-lockfile

COPY --from=builder --chown=bun:bun /app/build ./build
# adapter-node résout build/client depuis build/server/chunks/ (import.meta.url du chunk).
RUN ln -sfn ../../client /app/build/server/chunks/client
COPY --from=builder --chown=bun:bun /app/drizzle ./drizzle
COPY --from=builder --chown=bun:bun /app/src/lib/server/db ./src/lib/server/db
COPY --from=builder --chown=bun:bun /app/scripts ./scripts

RUN mkdir -p /app/logs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
	CMD wget -q --spider -T 5 http://127.0.0.1:3000/health || exit 1

CMD ["bash", "scripts/coolify-start.sh"]

FROM docker.elastic.co/beats/filebeat:9.0.0 AS filebeat
USER root
COPY filebeat.yml /usr/share/filebeat/filebeat.yml
