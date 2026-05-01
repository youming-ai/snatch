# Snatch — Agent Notes

Bun monorepo (3 packages) for a social-media video downloader. Astro 5 + React 19 frontend, Hono API, yt-dlp extraction engine.

## Package Boundaries

| Package | Role | Entrypoint | Deps |
|---------|------|------------|------|
| `packages/shared` | Types, validation, constants | `src/index.ts` | **zero** — no `bun`, no framework |
| `packages/api` | Hono REST server | `src/index.ts` | `shared`, `hono`, `yt-dlp` (system binary) |
| `packages/web` | Astro SSR + React UI | `src/pages/index.astro` | `shared`, `astro`, `react`, `lucide-react` |

## Developer Commands

```bash
# Install (root only; workspace deps auto-linked)
bun install

# Dev (needs two terminals)
bun dev:api        # http://localhost:3001 — API hot reload
bun dev            # http://localhost:4321 — Astro dev server

# Build order matters: shared → api → web
bun build          # all packages
bun build:api      # shared typecheck + api build
bun build:web      # web only

# Testing (Bun built-in test runner)
bun test           # all packages
bun test:shared    # single package
bun test:api
bun test:web

# Lint / Format / Typecheck (Biome)
bun lint           # biome check .
bun lint:fix       # biome check --fix .
bun format         # biome format --write .
bun check          # alias for lint:fix
bun typecheck      # tsc --noEmit across all packages
```

## Pre-Commit / Pre-Push Hooks (Husky)

- **pre-commit** → `bun run check` (biome lint + format auto-fix)
- **pre-push** → `bun run typecheck`

If either fails, the operation is blocked. Fix issues and retry.

## Setup Requirements

1. **Bun >= 1.3**
2. **yt-dlp** binary on `PATH` (for local API dev; Docker image includes it)
3. **Copy `.env.example` → `.env`** and adjust `API_URL` / `API_URL_INTERNAL` as needed

## Architecture Notes

- **Web SSR proxy**: Astro's `/api/download` endpoint validates + rate-limits, then proxies to the internal API (`API_URL_INTERNAL`). Browser download links point to the public API (`API_URL_PUBLIC`).
- **Environment loading**: Astro/Vite reads env via `import.meta.env`. Public env vars **must** use `PUBLIC_` prefix (e.g. `PUBLIC_RATE_LIMIT_MAX`).
- **Shared package discipline**: Keep it dependency-free. If you need to add a runtime dep, add it to the consumer package instead.
- **Type safety**: `shared` typechecks first in every build. Web typecheck runs `astro check` + `tsc --noEmit`.

## Docker

```bash
docker compose up -d --build
# Web → http://localhost:38700
# API  → http://localhost:38701
```

`API_URL_INTERNAL=http://api:3001` resolves inside the `snatch` Docker network.

## Style / Tooling

- **Formatter + Linter**: Biome (`biome.json`).
  - Indent: tabs, line width 100
  - Quotes: double, semicolons: always, trailing commas: all
  - Strict rules: `noUnusedVariables` error, `noUnusedImports` error, `useConst` error
- **No CI workflows** — rely on Husky hooks + local verification.

## Testing Notes

- Uses `bun:test` (built-in). `describe`, `it`, `expect`, `mock` all imported from `bun:test`.
- No special fixtures or services needed; all tests are unit-level with mocked env.
- `packages/web/src/middleware/security.test.ts` mocks `@/config/env` via `mock.module()`.
