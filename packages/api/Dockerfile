# syntax=docker/dockerfile:1.7
# =============================================================================
# Stage 1: Builder — install deps, bundle API with `bun build` to a single
#          self-contained dist/index.js (hono + @snatch/shared are inlined).
# =============================================================================
# Pinned to match the Bun version used to generate bun.lock.
# Bump this tag alongside any local `bun upgrade` + lockfile regeneration.
FROM oven/bun:1.3.11 AS builder
WORKDIR /app

# All workspace package.json files must be present for `bun install --frozen-lockfile`
# to succeed, even though only `@snatch/api` is built from source below.
COPY package.json bun.lock* ./
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

WORKDIR /app/packages/shared
RUN bun run typecheck

WORKDIR /app/packages/api
RUN bun run build

# =============================================================================
# Stage 2: Runtime — minimal image with just Bun + yt-dlp + the bundle.
# =============================================================================
FROM oven/bun:1.3.11-slim AS runtime
WORKDIR /app

# yt-dlp is invoked as a subprocess; needs Python + the pip-installed CLI.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ca-certificates \
    curl \
    && pip3 install --break-system-packages --no-cache-dir yt-dlp \
    && apt-get purge -y python3-pip \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /root/.cache

COPY --from=builder /app/packages/api/dist/index.js ./index.js

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["bun", "run", "index.js"]
