# Repository Guidelines

Bun monorepo (3 workspace packages) that resolves and downloads media from social platforms. A React 19 + TanStack Start SPA (no SSR) talks to a Hono API that wraps a self-provisioning `yt-dlp` binary as its extraction engine. Ships as an **all-in-one** Docker image: the API serves the built SPA and the `/api/*` routes on one origin.

## Project Overview

- Paste a URL → API probes it with `yt-dlp` → returns signed per-format download choices → browser opens an SSE progress stream → once the file is ready it downloads directly from the API via a plain `<a download>`.
- Supported sites: whatever `yt-dlp` reaches (~1,800). There is **no** host allowlist — `validateUrl` accepts any public http(s) URL and only refuses private/loopback/link-local/single-label hosts. `SERVICES` in `packages/shared/src/constants.ts` is UI copy for the "popular services" grid, mirroring upstream [yoinks](https://github.com/pablostanley/yoinks) — a list of what people paste, not a compatibility promise: yt-dlp runs without cookie flags unless the operator mounts a jar through `YTDLP_COOKIES_FILE`, so login-gated players (Vimeo's web client — and YouTube, from a datacenter IP) fail with the engine's own message.
- The engine needs `child_process` + a writable filesystem, so it **cannot run on Cloudflare Workers/Pages** — the all-in-one Docker image is the intended production shape.

## Package Boundaries

| Package | Role | Entrypoint | Runtime deps |
|---|---|---|---|
| `packages/shared` | Types, constants, URL validation | `src/index.ts` | **zero** — no framework, no `zod` |
| `packages/api` | Hono server, yt-dlp engine, routes, middleware, URL signing | `src/index.ts` (Bun entry) | `hono`, `hono-pino`, `pino`, `zod`, `@sentry/bun`, `@snatch/shared` |
| `packages/web` | TanStack Start SPA (`ssr: false`) | `src/routes/__root.tsx` → `routes/index.tsx` | React 19, `@tanstack/react-{start,router}`, `@sentry/react`, `lucide-react`, Tailwind v4 |

Import graph is strictly one-directional: `shared → {api, web}`; api and web never import each other. Consumers import the **barrel** (`import { … } from "@snatch/shared"`), never a subpath. `packages/shared/package.json` has no `dependencies` key — keep it that way.

## Architecture & Data Flow

```
All-in-one:  GET /             → Hono serves built SPA from ./public (serveStatic)
             POST /api/resolve → cors → rateLimit → apiKeyAuth → validateUrl
                                 → yt-dlp probe → buildChoices → HMAC-signed progress URL
             GET  /api/download/progress → verify signature → yt-dlp exec → SSE progress events
             GET  /api/download → verify file-path signature → 200 / 206 stream → delete at EOF
```

- **Middleware order** (`src/app.ts`): `secureHeaders` + `pinoLogger` (all) → `cors` → `rateLimit` → `apiKeyAuth`, all on `/api/*`, then routers at `/`. `app.onError` is the global net. `GET /health` is at root, outside `/api/*`, so it skips the cors/limit/auth chain — the logger and the security headers still apply.
- **Signed downloads**: `/api/resolve` builds each choice's `/api/download/progress` URL absolute to the API origin and HMAC-signs the params (`lib/security.ts`). The progress endpoint runs yt-dlp, then signs a short-lived `/api/download?file=...` URL for the prepared file. `/api/download` re-verifies that file-path signature (timing-safe), answers a single `Range` with `206` so a browser can resume, and deletes the file once it has been delivered to EOF — a transfer the client abandoned is left to the temp sweeper instead. Cross-origin downloads need no CORS because they are an `<a download>` navigation, not a `fetch`. Only `POST /api/resolve` is a cross-origin `fetch`, gated by `ALLOWED_ORIGINS`.
- **Two error shapes on `/api/resolve`**: validation failures → `400 {success:false, error}`; engine failures → `200 {status:"error", error:{code,message}}`. Clients branch on both `!response.ok` and `data.status === "error"`. Failures are logged (`c.var.logger`) and only the unexpected ones reach Sentry from the client.
- **Response hardening** (`src/app.ts`): `secureHeaders` sets the baseline on every response (nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, HSTS without `includeSubDomains`). There is no CSP, and that is deliberate: the prerendered shell contains three inline `<script>` blocks (JSON-LD plus TanStack Start's `$_TSR` bootstrap and scroll restoration), and `serveStatic` serves a finished file with nowhere to inject a nonce — so `script-src 'self'` blanks the page and `'unsafe-inline'` is not worth shipping. A real policy requires serving the shell through Hono and rewriting those tags.
- **Engine** (`lib/ytdlp.ts`): `ensureYtDlp()` resolves the binary (PATH → `$YTDLP_DIR` cache → download; one provisioning attempt at a time, and a download is cached only after it successfully runs), `probe()` runs `yt-dlp -J` under a 60s deadline with a metadata size cap and shape-guards stdout via `parseVideoInfo()`, `buildChoices()` derives video/audio choices, `downloadWithProgress()` runs yt-dlp with a `PROGRESS_TEMPLATE` and yields bytes/speed/ETA/processing events (mirroring yoinks), killing the child after 120s of silence. Before reporting success it confirms the file yt-dlp named actually exists — a missing `ffmpeg` makes yt-dlp exit 0 while producing nothing, and without that check the browser is handed a signed URL for a file that is not there. `cookiesArgs()` adds `--cookies` when `YTDLP_COOKIES_FILE` names a readable *file* (a directory is the Docker bind-mount trap and is rejected), which is what gets past login-gated players and datacenter-IP refusals; `hasFfmpeg()` memoizes its check once per process.
- **Temp files** (`lib/tmp-cleanup.ts`): probe metadata and prepared media are written to `os.tmpdir()` under the `snatch-` prefix. Each request cleans up after itself; `startTmpCleanup()` (started from `src/index.ts`, never from `app.ts`, so tests spawn no timer) is the backstop — it deletes anything untouched for 2h and evicts the oldest idle files above a 4GB cap, sparing anything written in the last 10 minutes so an in-flight transfer survives.
- **Env access split**: request-scoped config (`ALLOWED_ORIGINS`, `API_RATE_LIMIT_*`, `API_IP_HEADER`, `API_KEY`, `PROXY_SIGNING_KEY`) via `env(c)`; process-lifetime config (`PORT`, `STATIC_ROOT`, `LOG_LEVEL`, `SENTRY_DSN`, `YTDLP_DIR`) via `process.env`. Web reads `import.meta.env` (`VITE_` prefix only).

## Key Directories

- `packages/shared/src/` — types, constants, pure URL validation; zero deps.
- `packages/api/src/routes/` — one Hono router per file, exported as `<name>Router`.
- `packages/api/src/lib/` — engine and pure helpers (`ytdlp`, `security`, `range`, `tmp-cleanup`).
- `packages/api/src/middleware/` — `/api/*` middleware (`rate-limit`, `auth`).
- `packages/api/src/schemas/` — Zod request narrowing.
- `packages/web/src/routes/` — file-based TanStack Router routes.
- `packages/web/src/components/` — React UI (`DownloaderApp`, `DownloaderInput`, `ErrorBoundary`).

## Important Files

- `packages/api/src/index.ts` — Bun entry: layers `serveStatic` over the app, starts the temp sweeper, warns at boot when `ffmpeg` is missing, exports `{ port, fetch }`.
- `packages/api/src/app.ts` — Hono app + middleware chain; default-exports the raw `app`.
- `packages/api/src/routes/download.ts` — `POST /api/resolve`, signed `GET /api/download` (whole file or one byte range), `GET /api/info` (engine plus `ffmpeg` availability).
- `packages/api/src/lib/ytdlp.ts` — `ensureYtDlp`/`probe`/`buildChoices`/`parseVideoInfo`/`downloadWithProgress`/`hasFfmpeg`.
- `packages/api/src/lib/security.ts` — `signUrl`/`verifyUrl` (HMAC-SHA256, timing-safe), `sanitizeFilename`, `getSecret`.
- `packages/api/src/lib/range.ts` — `parseRange()`: a byte range, `null` for a form it does not support, `"unsatisfiable"` for a 416.
- `packages/api/src/lib/tmp-cleanup.ts` — `TMP_PREFIX`, `cleanupStaleFiles()`, `startTmpCleanup()`.
- `packages/api/src/middleware/rate-limit.ts` — in-memory limiter keyed on `cf-connecting-ip`/`fly-client-ip` or `API_IP_HEADER` (never an unconfigured `x-forwarded-for`), UA-hash fallback; exports `clearClients()`.
- `packages/api/src/middleware/auth.ts` — `apiKeyAuth()`: optional `API_KEY`-gated `Authorization: Api-Key <value>`, no-op when unset.
- `packages/api/src/schemas/media.ts` — `resolveInputSchema` layers shared `validateUrl` onto structural Zod checks; narrow new request options here.
- `packages/shared/src/validation.ts` — exports only `validateUrl()` (pure). No `sanitizeUrl`, no `detectPlatform`.
- `packages/shared/src/constants.ts` — `SERVICES` (UI labels only, no hosts). `types.ts` — the wire contract for `/api/resolve` and its picker items.
- `packages/web/src/config.ts` — `API_BASE_URL` (empty; SPA is served same-origin by the API). `components/DownloaderApp.tsx` — owns UI state + resolve/download flow. `routes/__root.tsx` — the prerendered head, including the build-time `VITE_SITE_URL`/`VITE_CLARITY_ID` tags.
- `packages/web/src/routeTree.gen.ts` — generated; commit it, never edit, excluded from Biome.
- `biome.json`, `bunfig.toml` (`[test] root="."`), `packages/api/Dockerfile` (two-stage; runtime installs `ca-certificates` + `ffmpeg` only), `docker-compose.yml` (generic VPS), `.env.example`, `.github/workflows/ci.yml`.

## Development Commands

```bash
bun install          # root; runs `lefthook install` via prepare

# Dev (two terminals)
bun dev:api          # :3001 — API with --watch
bun dev              # :5173 — Vite, proxies /api → :3001

# Build / deploy — ALWAYS `bun run` for aggregate scripts
bun run build        # shared typecheck + api build + web build

bun test             # all packages (bunfig.toml discovers every *.test.ts)
bun run test         # the same via per-package fan-out (skips web, which has no test script)
bun run typecheck    # tsc --noEmit across all packages (pre-push hook)
bun run check        # biome check --fix .  (pre-commit runs Biome on staged files)

bun run docker:up    # docker compose up -d --build
```

> **Gotcha**: `build`/`test` collide with Bun's reserved subcommands. Bare `bun test` works via `bunfig.toml`, but **bare `bun build` runs the bundler, not the aggregate script** — always `bun run build`. CI and the Dockerfile use `bun run`.

## Code Conventions & Common Patterns

- **Biome** owns formatting + linting. Tabs, line width **100**, double quotes, semicolons always, trailing commas all. Blocking: `noUnusedVariables`/`noUnusedImports`/`useConst`/`noUselessStringConcat` **error**; `noNonNullAssertion`/`noExplicitAny` **warn**. Scans `packages/*/src` (+ `api/test`), excludes `routeTree.gen.ts`.
- **Clean cutover**: migrate every caller and delete the old path — no aliases, shims, dead code, or commented-out blocks.
- **Validate at boundaries**: URL validation lives in `shared` (pure); both the API Zod schema and the web form call `validateUrl()`, so client feedback and server rejection never drift. Its host check is a cheap literal-hostname filter, not a network boundary — it cannot see a public name resolving to a private address, DNS rebinding, or redirects yt-dlp follows. Untrusted yt-dlp stdout passes through `parseVideoInfo()`. Keep `shared` zero-dependency.
- **Boundary narrowing**: request options flow through `schemas/media.ts` and nowhere else — new input is added to the Zod schema, never checked ad-hoc inside a handler.
- **Hono routes**: one file per router under `routes/`, exported `<name>Router`, mounted `app.route("/", <name>Router)`. Handlers always return `c.json(...)` with an explicit status.
- **React state**: no state library — `useState` per concern in `DownloaderApp`, and `DownloaderInput` owns its own input value. The live `EventSource` lives in a ref so cancel, a new download, and unmount can all close it. Root wraps the app in `ErrorBoundary`. `lucide-react` icons. Tailwind v4 is CSS-first (`src/styles.css`, no `tailwind.config.js`).
- **Sentry** is DSN-gated and independent per side: `@sentry/bun` (`SENTRY_DSN`) in API, `@sentry/react` (`VITE_SENTRY_DSN`) in SPA. The client distinguishes an `ApiError` (a failure the API reported on purpose) from a real fault, and reports only the latter.
- **Never trust an exit code for a side effect**: yt-dlp exits 0 after a failed merge and a `spawn` reports `code === 0` for a process that produced nothing. Assert the artifact.

## Runtime / Tooling Preferences

- **Bun 1.3.14** (pinned in `packageManager`, CI, and both Docker stages). Bun workspaces only — fan-out via `bun --filter '<pkg>' <script>`; no turborepo/nx.
- **TanStack Start in SPA mode** (`ssr: false`); no SSR runtime is deployed. Server-side React / SSR is an anti-pattern here.
- **Browser-exposed env vars must use the `VITE_` prefix**; `VITE_SENTRY_DSN`, `VITE_SITE_URL` and `VITE_CLARITY_ID` also flow in as Docker build ARGs. All three default to off, so a self-hosted instance ships no analytics and never advertises another deployment's domain.
- Each package has a standalone strict `tsconfig.json` (`ES2022`, `moduleResolution bundler`, `noEmit`); no shared base, no project references. `packages/api` includes `test/**/*.ts` in its typecheck, so tests are type-checked too.

## Testing & QA

- **Framework**: `bun:test` only (`describe`/`it`/`expect`/`beforeEach`/`afterEach`). No mocking library — isolation via real code paths, env save/restore, and the exported `clearClients()` hook.
- **HTTP pattern**: `app.fetch(new Request(...))` against a throwaway `new Hono()` (`createTestApp()` helper) or the real singleton from `../src/app`. Prefer `../src/app`, not `../src/index` (the latter mounts `serveStatic` + inits Sentry on import).
- **Subprocess behaviour** is tested against a fake executable written to the temp dir rather than by mocking `spawn`; `downloadWithProgress` accepts `idleTimeoutMs` so a stall test need not wait two minutes.
- **Coverage**: shared validation/hardening; API `apiKeyAuth`, `rateLimit` (client bucketing + env fallbacks), resolve validation, CORS allowlist, security headers, `/api/info`, signed `/api/download` (whole file, ranged, 416, filename), `buildChoices`, `parseRange`, temp sweeping, `probe` error paths, and the download guards (stall timeout, missing artifact). No coverage tooling configured.
- **No web unit tests** — the SPA is exercised in the browser, so `@snatch/web` has no `test` script and the `test` fan-out skips it.
- **Real downloads** need `yt-dlp` (auto-provisioned) and `ffmpeg` on PATH; without `ffmpeg` the boot log and `GET /api/info` say so, and a download fails with "no file was produced".
- **Smoke test**: `bun dev:api` + `bun dev`, open `http://localhost:5173`, paste a URL — a site the engine cannot extract → red error card; a supported one → format picker.

## Environment Variables

| Var | Service | Default | Purpose |
|---|---|---|---|
| `APP_PORT` | docker-compose | `38700` | Host port for `app` |
| `PORT` | API | `3001` | Container listen port |
| `ALLOWED_ORIGINS` | API | `""` (reject all) | Comma-separated CORS allowlist for `/api/*`; an origin not on it gets no `Access-Control-Allow-Origin`. Unused in the all-in-one build (SPA is same-origin). |
| `API_KEY` | API | `""` (public) | When set, `/api/*` requires `Authorization: Api-Key <value>` |
| `API_RATE_LIMIT_MAX` / `_WINDOW` | API | `30` / `60000` | Rate limit count / window (ms). A non-positive or unparseable value falls back to the default rather than disabling the limit. |
| `API_IP_HEADER` | API | `""` | Header a reverse proxy sets to the caller's address (Nginx: `x-real-ip`). Unset → UA-hash bucketing, which lumps every caller of one browser version together. Never point it at an appending `x-forwarded-for`. |
| `PROXY_SIGNING_KEY` | API | `""` (random) | HMAC key for media URLs. Empty → random per-process key (links die on restart) |
| `STATIC_ROOT` | API | `./public` | Static SPA directory |
| `LOG_LEVEL` | API | `info` | Pino log level |
| `SENTRY_DSN` | API | `""` | `@sentry/bun` DSN; disabled when unset |
| `YTDLP_DIR` | API | `~/.snatch/bin` | yt-dlp binary cache (Docker: `/data/yt-dlp`) |
| `YTDLP_COOKIES_FILE` | API | `""` | Netscape-format cookie jar handed to yt-dlp as `--cookies`. Empty → cookie-less, so login-gated and datacenter-IP-blocked sites fail. Must be a file, not a directory. |
| `VITE_API_TARGET` | web (dev) | `http://localhost:3001` | Vite `/api` proxy target |
| `VITE_SENTRY_DSN` | web (build) | `""` | `@sentry/react` DSN; disabled when unset |
| `VITE_SITE_URL` | web (build) | `""` | Public origin for the canonical link and og tags. Empty → those tags are omitted. |
| `VITE_CLARITY_ID` | web (build) | `""` | Microsoft Clarity project id. Empty → no analytics script is emitted. |

## CI, Git Hooks & Attribution

- **CI** (`.github/workflows/ci.yml`, on PR + push to `main`): install → `bunx biome ci .` → `bun run typecheck` → `bun test` → `bun run build`. Validation-only; deploys happen out-of-band on the VPS.
- **Git hooks: lefthook** (not Husky). pre-commit → Biome on staged files (auto-stages fixes); pre-push → `bun run typecheck`.
- AI-assisted commits MUST include: `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Definition of Done

- `bun run check` and `bun run typecheck` pass.
- `bun test` passes.
- `bun run build` produces `packages/web/dist/client` and `packages/api/dist/index.js`.
- UI changes: browser smoke-test. API changes: verify in `packages/api/test/`.

## Anti-Patterns (avoid without discussion)

- Adding a runtime dependency to `packages/shared`.
- Hand-rolling URL parsing outside `validateUrl`.
- Server-side React / SSR.
- Bare `bun build` for the aggregate build (use `bun run build`).
- Bypassing lefthook hooks with `--no-verify`.
- Dead code, unused exports, or commented-out code instead of a clean delete.
- "MVP" / "scaffold" / "TODO: implement" labels in shipped code.
