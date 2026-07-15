# Repository Guidelines

Bun monorepo (3 workspace packages): React 19 + Vite SPA served as static files by a Hono API that resolves and proxies media through a self-hosted [cobalt](https://github.com/imputnet/cobalt) instance. Single public origin; cobalt is internal-only.

## Package Boundaries

| Package | Role | Entrypoint | Notable deps |
|---|---|---|---|
| `packages/shared` | Types, validation, host allowlist | `src/index.ts` | **zero** — no `bun`, no framework; no `hono` |
| `packages/api` | Hono server, cobalt client, routes, middleware | `src/index.ts` (Bun entry) | `hono`, `@snatch/shared` |
| `packages/web` | React SPA (no SSR) | `index.html` → `src/main.tsx` | `react`, `react-dom`, `lucide-react`, Tailwind v4, Vite |

Cross-package import rule: every consumer imports from the `@snatch/shared` **barrel** (`import { ... } from "@snatch/shared"`). Subpath exports exist in `packages/shared/package.json` for tree-shaking but are not the current convention.

## Architecture & Data Flow

```
Browser ─ GET /              → API serves built SPA from ./public
Browser ─ GET /api/download  → API: validateUrl → rateLimit → resolveViaCobalt → fetch → pipe bytes
                                              ↓
                                          cobalt (tunnel/redirect/picker) → source CDN
```

- **Single origin**: Hono serves the built SPA (`packages/web/dist` copied to `./public` in the Docker image) and `/api/*` on one port. In dev, Vite (`:5173`) serves the UI and proxies `/api` to the API (`:3001`).
- **Cobalt stays internal**: API resolves the best-quality media URL via `resolveViaCobalt()` (`packages/api/src/lib/cobalt.ts`), then `fetch()`-proxies the file bytes so the browser only ever talks to our origin.
- **Environment loading**: web reads build-time env via `import.meta.env`; browser-exposed vars MUST use Vite's `VITE_` prefix. API reads `process.env`.
- **Rate limit**: ignores generic `x-forwarded-for`; uses `cf-connecting-ip` / `fly-client-ip` from a trusted proxy, falls back to hashed user-agent. See `packages/api/src/middleware/rate-limit.ts`.
- **URL validation**: `detectPlatform()` matches the parsed hostname (not the full URL string) against `PLATFORM_HOSTS` derived from the `SERVICES` array in `packages/shared/src/constants.ts`.

## Key Directories & Files

- `packages/shared/src/constants.ts` — single source of truth for the 21 supported services, host allowlist, `SupportedPlatform` union.
- `packages/shared/src/validation.ts` — `validateUrl()`, `detectPlatform()`, `sanitizeUrl()`, `isRetryableError()`. No I/O, pure.
- `packages/api/src/index.ts` — Hono app: logger → CORS → rateLimit (on `/api/*`) → routes → `serveStatic` fallback.
- `packages/api/src/routes/download.ts` — `/api/download?url=...`: validate → resolve via cobalt → stream the upstream body. `Content-Disposition` is sanitized (`["\r\n]` stripped, capped at 200 chars).
- `packages/api/src/lib/cobalt.ts` — `resolveViaCobalt(url, videoQuality)`; tests use `setCobaltApiUrlForTest` + mocked `globalThis.fetch`. Handles `tunnel` / `redirect` / `picker` (picks first `type==="video"` or first item) / `error` statuses.
- `packages/api/src/middleware/rate-limit.ts` — in-memory `Map<clientId, {count, resetTime}>`; periodic `setInterval` GC every 5 min.
- `packages/web/src/components/DownloaderApp.tsx` — owns `url`/`loading`/`error`/`savedName` state; fetches `/api/download`, creates a blob URL, triggers a synthetic `<a download>` click. On success, shows a green confirmation card.
- `packages/web/vite.config.ts` — `react()` + `tailwindcss()` plugins; dev proxy `/api` → `VITE_API_TARGET || http://localhost:3001`; `build.outDir: "dist"`.
- `packages/api/Dockerfile` — multi-stage (`oven/bun:1.3.11` builder → `oven/bun:1.3.11-slim` runtime); copies `api/dist/index.js` and `web/dist/` into `/app/public`; exposes `3001`.
- `docker-compose.yml` — `app` + `cobalt` services on the `snatch` bridge network; cobalt has no published port. `cobalt:11` image from `ghcr.io/imputnet/cobalt`.

## Development Commands

```bash
# Install (root)
bun install

# Dev (two terminals)
bun dev:api        # http://localhost:3001 — API with --watch
bun dev            # http://localhost:5173 — Vite, proxies /api → :3001

# Build (SPA first so the API image can bundle it)
bun build          # shared typecheck + api build + web build
bun build:api      # shared typecheck + api build
bun build:web      # web SPA only

# Test (bun:test, root = ".")
bun test           # all packages
bun test:shared    # single package
bun test:api
bun test:web       # (no web tests today)

# Lint / Format / Typecheck (Biome)
bun lint           # biome check .
bun lint:fix       # biome check --fix .
bun format         # biome format --write .
bun check          # alias for lint:fix  (used by pre-commit)
bun typecheck      # tsc --noEmit across all packages (used by pre-push)

# Docker
bun docker:up      # docker compose up -d --build
bun docker:down    # docker compose down
```

## Runtime / Tooling Constraints

- **Bun >= 1.3** (Docker pins `oven/bun:1.3.11`; bump alongside `bun upgrade` + lockfile regen).
- **Single package manager**: Bun workspaces; do NOT add `node_modules` from npm/yarn/pnpm.
- **No SSR**. No separate web tier. No SSR runtime, no `next`, no astro runtime.
- **Browser-exposed env vars must use `VITE_` prefix**.
 - **The API only shells out to `ffmpeg`** for local-processing remuxing. All other media resolution is HTTP-only; there are no other system binaries.
- **Bun test root** is the repo root (`bunfig.toml`), so test files anywhere match `*.test.ts` / `*.test.tsx`.

## Code Conventions

- **Biome** owns formatting and linting. Indent: **tabs**, line width **100**, double quotes, semicolons **always**, trailing commas **all**. Strict rules: `noUnusedVariables` and `noUnusedImports` are **errors** (CI-blocking), `useConst` error, `noNonNullAssertion` warn, `noExplicitAny` warn.
- **No paragraphs in commit messages** — `bun run commit` is wired up to Husky; follow the project commit skill.
- **Default to the new code, not shims**: when refactoring, migrate every caller and delete the old path. No deprecated aliases.
- **Validate at boundaries**: URLs and uploads are validated in `shared` (pure) and re-checked implicitly by cobalt. Don't bypass with hand-rolled checks.
- **No `as unknown as` except at the `Object.fromEntries` / generic-Record seam** in `shared/src/constants.ts`. If you find yourself reaching for it elsewhere, the type is probably wrong.
- **Mocking tests**: API tests override `globalThis.fetch = mock(...)` and use `setCobaltApiUrlForTest` to redirect the cobalt base URL. Save/restore in `afterEach` via `originalFetch` / `resetCobaltApiUrlForTest()`.
- **Hono route shape**: one file per router under `packages/api/src/routes/`, exported as `<name>Router`, mounted with `app.route("/", <name>Router)` in `src/index.ts`.
- **React state**: `useState` per concern; no global state lib. `ErrorBoundary` wraps the whole app. `lucide-react` for icons.

## Testing & QA

- **Framework**: `bun:test` (`describe`, `it`, `expect`, `beforeEach`, `afterEach`, `mock`). Imports from `bun:test` only.
- **Test files**:
  - `packages/shared/src/validation.test.ts` — unit-tests `validateUrl`, `detectPlatform`, `sanitizeUrl`, `isRetryableError`, plus URL hardening.
  - `packages/api/src/middleware/rate-limit.test.ts` — in-process Hono `app.fetch(new Request(...))`; calls `clearClients()` in `beforeEach`.
  - `packages/api/test/cobalt.test.ts` — mocks `globalThis.fetch`; covers `tunnel`, `redirect`, `picker` (picks first `type==="video"`), `error` statuses.
  - `packages/api/test/cors.test.ts` — asserts CORS rejects when `ALLOWED_ORIGINS` is empty.
- **No web unit tests**. The SPA is exercised via the browser. Smoke test: `bun dev:api` + `bun dev`, open `http://localhost:5173`, paste a URL.
- **Test scripts that depend on a running cobalt** need `COBALT_API_URL` set; otherwise the `bun dev:api` flow will 502 on real downloads (client error path is still testable).

## Environment Variables

| Var | Service | Default | Purpose |
|---|---|---|---|
| `APP_PORT` | docker-compose | `38700` | Host port for `app` |
| `PORT` | API | `3001` | Container listen port |
| `ALLOWED_ORIGINS` | API | `""` (reject all) | Comma-separated CORS allowlist for `/api/*`. Same-origin SPA needs none. |
| `API_RATE_LIMIT_MAX` | API | `30` | Max requests per window |
| `API_RATE_LIMIT_WINDOW` | API | `60000` (ms) | Rate window |
| `COBALT_API_URL` | API | `http://localhost:9000` | Internal cobalt instance. Inside docker-compose: `http://cobalt:9000`. |
| `STATIC_ROOT` | API | `./public` | Override the SPA static dir |
| `VITE_API_TARGET` | web (dev) | `http://localhost:3001` | Vite dev proxy target for `/api` |
| `PROXY_SIGNING_KEY` | API | `""` (random) | HMAC key to sign media proxy links to prevent SSRF. If empty, a random key is generated at startup. |

## Pre-Commit / Pre-Push Hooks (Husky)

- **pre-commit** → `bun run check` (Biome lint + format auto-fix). Hook blocks on errors.
- **pre-push** → `bun run typecheck`. Hook blocks on errors.
- If either fails, fix and retry — don't bypass with `--no-verify` unless explicitly authorized.

## Commit Attribution

AI-assisted commits MUST include:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Definition of Done

- `bun run check` passes (Biome).
- `bun run typecheck` passes.
- `bun test` passes (current count: 27 tests across shared + API).
- `bun run build` produces a deployable `packages/web/dist` and `packages/api/dist/index.js`.
- For UI changes, smoke-test in browser: unsupported host → red error card; valid host → success card with filename.
- For API changes, verify in `packages/api/test/` with mocked `fetch` where possible.

## Anti-Patterns (avoid without discussion)

- Adding a runtime dependency to `packages/shared`.
- Hand-rolling URL parsing outside `validateUrl` / `detectPlatform`.
- Server-side React / SSR.
- Bypassing Husky hooks with `--no-verify`.
- Leaving dead code, unused exports, or commented-out code in lieu of a clean delete.
- "MVP" / "scaffold" / "TODO: implement" labels in shipped code.
