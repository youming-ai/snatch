# syntax=docker/dockerfile:1.7
# =============================================================================
# Stage 1: Builder — install deps, build the Vite React SPA, then bundle the
#          API to a single self-contained dist/index.js. The API serves the
#          SPA's static output, so this one image is the whole app.
# =============================================================================
# Pinned to match the Bun version used to generate bun.lock.
# Bump this tag alongside any local `bun upgrade` + lockfile regeneration.
FROM oven/bun:1.3.14 AS builder
WORKDIR /app

# All workspace package.json files must be present for `bun install --frozen-lockfile`.
COPY package.json bun.lock* ./
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
COPY packages/web ./packages/web

WORKDIR /app/packages/shared
RUN bun run typecheck

# Build the SPA → packages/web/dist
WORKDIR /app/packages/web
RUN bun run build

# Bundle the API → packages/api/dist/index.js
WORKDIR /app/packages/api
RUN bun run build

# =============================================================================
# Stage 2: Runtime — Bun + the API bundle + the SPA static files. The API
#          shells out to ffmpeg for local-processing remuxing, so both
#          CA certificates and ffmpeg are needed.
# =============================================================================
FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/packages/api/dist/index.js ./index.js
COPY --from=builder /app/packages/web/dist ./public

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["bun", "run", "index.js"]
