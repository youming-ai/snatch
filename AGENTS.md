# Repository Guidelines

Bun monorepo (3 workspace packages): React 19 + Vite SPA served as static files by a Hono API that resolves and processes media using a built-in `yt-dlp` engine. Single public origin.

## Package Boundaries

|Package|Role|Entrypoint|Notable deps|
|---|---|---|---|
|`packages/shared`|Types, validation, host allowlist|`src/index.ts`|**zero** — no `bun`, no framework; no `hono`|
|`packages/api`|Hono server, yt-dlp engine, routes, middleware|`src/index.ts` (Bun entry)|`hono`, `@snatch/shared`|
|`packages/web`|React SPA (no SSR)|`index.html` → `src/main.tsx`|`react`, `react-dom`, `lucide-react`, Tailwind v4, Vite|

Cross-package import rule: every consumer imports from the `@snatch/shared` **barrel** (`import { ... } from "@snatch/shared"`).

## Architecture & Data Flow

```
Browser ─ GET /              → API serves built SPA from ./public
Browser ─ POST /api/resolve  → API: validateUrl → rateLimit → probe via yt-dlp → return formats
Browser ─ GET /api/download → API: verifyUrl → executeDownload via yt-dlp → stream bytes
```

- **Single origin**: Hono serves the built SPA (`packages/web/dist` copied to `./public` in the Docker image) and `/api/*` on one port. In dev, Vite (`:5173`) serves the UI and proxies `/api` to the API (`:3001`).
- **yt-dlp engine**: API uses `ensureYtDlp()` (`packages/api/src/lib/ytdlp.ts`) to resolve or download the standalone `yt-dlp` binary on demand. yt-dlp uses the `ffmpeg` binary available on the system PATH for merging and extraction.
- **Environment loading**: web reads build-time env via `import.meta.env`; browser-exposed vars MUST use Vite's `VITE_` prefix. API reads `process.env`.
- **Rate limit**: ignores generic `x-forwarded-for`; uses `cf-connecting-ip` / `fly-client-ip` from a trusted proxy, falls back to hashed user-agent. See `packages/api/src/middleware/rate-limit.ts`.
- **URL validation**: `detectPlatform()` matches the parsed hostname against `PLATFORM_HOSTS` derived from `SERVICES` in `packages/shared/src/constants.ts`.

## Key Directories & Files

- `packages/shared/src/constants.ts` — single source of truth for supported services and host allowlists.
- `packages/shared/src/validation.ts` — `validateUrl()`, `detectPlatform()`, `sanitizeUrl()`, pure validation.
- `packages/api/src/index.ts` — Hono app: logger → CORS → rateLimit (on `/api/*`) → routes → `serveStatic` fallback.
- `packages/api/src/routes/download.ts` — `/api/resolve` & `/api/download`: validate → probe/download via yt-dlp → stream output.
- `packages/api/src/lib/ytdlp.ts` — `ensureYtDlp()`, `probe()`, `buildChoices()`, `executeDownload()`.
- `packages/api/src/middleware/rate-limit.ts` — in-memory rate limiting.
- `packages/web/src/components/DownloaderApp.tsx` — React UI state & download launcher.
- `packages/api/Dockerfile` — multi-stage Bun runtime container with `ffmpeg` & `python3`.
- `docker-compose.yml` — runs `snatch-app` service.

## Development Commands

```bash
# Install (root)
bun install

# Dev (two terminals)
bun dev:api        # http://localhost:3001 — API with --watch
bun dev            # http://localhost:5173 — Vite, proxies /api → :3001

# Build
bun build          # shared typecheck + api build + web build
bun build:api      # shared typecheck + api build
bun build:web      # web SPA only

# Test (bun:test, root = ".")
bun test           # all packages
bun test:shared    # single package
bun test:api
bun test:web

# Lint / Format / Typecheck (Biome)
bun lint           # biome check .
bun lint:fix       # biome check --fix .
bun format         # biome format --write .
bun check          # alias for lint:fix (used by pre-commit)
bun typecheck      # tsc --noEmit across all packages (used by pre-push)

# Docker
bun docker:up      # docker compose up -d --build
bun docker:down    # docker compose down
```

## Runtime / Tooling Constraints

- **Bun >= 1.3**
- **Single package manager**: Bun workspaces.
- **No SSR**.
- **Browser-exposed env vars must use `VITE_` prefix**.

## Pre-Commit / Pre-Push Hooks (Husky)

- **pre-commit** → `bun run check` (Biome lint + format auto-fix).
- **pre-push** → `bun run typecheck`.

## Commit Attribution

AI-assisted commits MUST include:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```
