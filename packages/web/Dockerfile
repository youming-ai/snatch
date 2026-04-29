# syntax=docker/dockerfile:1.7
# =============================================================================
# Stage 1: Builder — install all deps, run Astro build (full SSR bundle).
#          astro.config.mjs sets `ssr.noExternal: true` so dist/server/entry.mjs
#          is fully self-contained; runtime needs no node_modules.
# =============================================================================
# Pinned to match the Bun version used to generate bun.lock.
# Bump this tag alongside any local `bun upgrade` + lockfile regeneration.
FROM oven/bun:1.3.11 AS builder
WORKDIR /app

# All workspace package.json files must be present for `bun install --frozen-lockfile`.
COPY package.json bun.lock* ./
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/web ./packages/web

WORKDIR /app/packages/shared
RUN bun run typecheck

WORKDIR /app/packages/web
RUN bun run build

# =============================================================================
# Stage 2: Runtime — just Bun + the ~2.5 MB dist/. No node_modules.
# =============================================================================
FROM oven/bun:1.3.11-slim AS runtime
WORKDIR /app

COPY --from=builder /app/packages/web/dist ./dist

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321

CMD ["bun", "run", "./dist/server/entry.mjs"]
