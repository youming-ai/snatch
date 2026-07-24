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
- `packages/api/src/app.ts` — Hono app: logger → CORS → rateLimit (on `/api/*`) → `downloadRouter` + `healthRouter`.
- `packages/api/src/index.ts` — Bun entry: mounts `serveStatic` (SPA) over the `app` and exports the server (`port`, `fetch`).
- `packages/api/src/routes/download.ts` — `POST /api/resolve`, signed `GET /api/download`, `GET /api/info`: validate → probe/download via yt-dlp → stream output.
- `packages/api/src/routes/health.ts` — `healthRouter`: `GET /health`.
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

## Code Conventions

- **Biome** owns formatting and linting. Indent: **tabs**, line width **100**, double quotes, semicolons **always**, trailing commas **all**. Strict rules: `noUnusedVariables` and `noUnusedImports` are **errors** (CI-blocking), `useConst` error, `noNonNullAssertion` warn, `noExplicitAny` warn.
- **Default to the new code, not shims**: when refactoring, migrate every caller and delete the old path. No deprecated aliases.
- **Validate at boundaries**: URLs are validated in `shared` (pure); untrusted yt-dlp stdout and cached info-json are parsed through a typed guard before use. Don't bypass with hand-rolled checks.
- **No `as unknown as` except at the `Object.fromEntries` / generic-Record seam** in `shared/src/constants.ts`. If you find yourself reaching for it elsewhere, the type is probably wrong.
- **Boundary narrowing**: request options are narrowed to their `MediaOptions` enums via `normalizeOptions` before reaching the engine. Add new options to the shared enum arrays, not ad-hoc string checks.
- **Hono route shape**: one file per router under `packages/api/src/routes/`, exported as `<name>Router`, mounted with `app.route("/", <name>Router)` in `src/app.ts`.
- **React state**: `useState` per concern; no global state lib. `ErrorBoundary` wraps the whole app. `lucide-react` for icons.

## Testing & QA

- **Framework**: `bun:test` (`describe`, `it`, `expect`, `beforeEach`, `afterEach`, `mock`). Imports from `bun:test` only.
- **Test files**:
  - `packages/shared/src/validation.test.ts` — unit-tests `validateUrl`, `detectPlatform`, `sanitizeUrl`, plus URL hardening.
  - `packages/api/src/middleware/rate-limit.test.ts` — in-process Hono `app.fetch(new Request(...))`; calls `clearClients()` in `beforeEach`.
  - `packages/api/test/ytdlp.test.ts` — unit-tests `buildChoices` option behavior against a `VideoInfo` fixture.
  - `packages/api/test/routes.test.ts` — `app.fetch(...)`; resolve validation plus signed `/api/download` (missing / tampered signature → 400 / 403).
  - `packages/api/test/download.test.ts` — download route behavior.
  - `packages/api/test/cors.test.ts` — asserts CORS rejects when `ALLOWED_ORIGINS` is empty.
- **No web unit tests**. The SPA is exercised via the browser. Smoke test: `bun dev:api` + `bun dev`, open `http://localhost:5173`, paste a URL.
- **Real downloads** need `yt-dlp` (auto-provisioned by `ensureYtDlp`) and `ffmpeg` on `PATH`; without `ffmpeg`, merges (`--merge-output-format`) and audio extraction (`-x`) fail.

## Environment Variables

| Var | Service | Default | Purpose |
|---|---|---|---|
| `APP_PORT` | docker-compose | `38700` | Host port for `app` |
| `PORT` | API | `3001` | Container listen port |
| `ALLOWED_ORIGINS` | API | `""` (reject all) | Comma-separated CORS allowlist for `/api/*`. Same-origin SPA needs none. |
| `API_RATE_LIMIT_MAX` | API | `30` | Max requests per window |
| `API_RATE_LIMIT_WINDOW` | API | `60000` (ms) | Rate window |
| `STATIC_ROOT` | API | `./public` | Override the SPA static dir |
| `VITE_API_TARGET` | web (dev) | `http://localhost:3001` | Vite dev proxy target for `/api` |
| `PROXY_SIGNING_KEY` | API | `""` (random) | HMAC key to sign media URLs to prevent SSRF/tampering. If empty, a random key is generated at startup. |
| `YTDLP_DIR` | API | `~/.snatch/bin` | Directory the standalone `yt-dlp` binary is cached in / downloaded to. |

## Pre-Commit / Pre-Push Hooks (Husky)

- **pre-commit** → `bun run check` (Biome lint + format auto-fix).
- **pre-push** → `bun run typecheck`.

## Commit Attribution

AI-assisted commits MUST include:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Definition of Done

- `bun run check` passes (Biome).
- `bun run typecheck` passes.
- `bun test` passes (current count: 35 tests across shared + API).
- `bun run build` produces a deployable `packages/web/dist` and `packages/api/dist/index.js`.
- For UI changes, smoke-test in browser: unsupported host → red error card; valid host → picker with format choices.
- For API changes, verify in `packages/api/test/` (signed download, resolve validation, `buildChoices`).

## Anti-Patterns (avoid without discussion)

- Adding a runtime dependency to `packages/shared`.
- Hand-rolling URL parsing outside `validateUrl` / `detectPlatform`.
- Server-side React / SSR.
- Bypassing Husky hooks with `--no-verify`.
- Leaving dead code, unused exports, or commented-out code in lieu of a clean delete.
- "MVP" / "scaffold" / "TODO: implement" labels in shipped code.
