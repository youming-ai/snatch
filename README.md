# Snatch

Social media video downloader — Bun monorepo: a React + Vite SPA served by a Hono API that resolves media via a self-hosted cobalt instance.

## Supported Platforms

| Platform | Video |
|----------|-------|
| X | ✅ |
| TikTok | ✅ |
| YouTube | ❌ (removed) |

## Project Structure

```
snatch/
├── packages/
│   ├── api/                # Bun + Hono API server
│   │   ├── src/
│   │   │   ├── routes/     # /health, /api/download
│   │   │   └── lib/        # cobalt (resolver)
│   │   └── test/
│   ├── web/                # React 19 + Vite SPA (static)
│   │   ├── index.html      # Vite entry
│   │   ├── src/
│   │   │   ├── components/ # DownloaderApp, DownloaderInput, ErrorBoundary
│   │   │   ├── main.tsx    # React root
│   │   │   └── styles.css
│   │   └── public/         # favicon, logos, manifest, robots.txt
│   └── shared/             # Types, validation, constants (zero deps)
│       └── src/
├── docker-compose.yml
├── package.json            # Bun workspace root
└── .env.example
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) >= 1.3
- A reachable [cobalt](https://github.com/imputnet/cobalt) instance (`docker compose` starts one; for local API dev run cobalt on `:9000`)

### Install

```bash
bun install
```

### Development

```bash
# Terminal 1: Start API (hot reload)
bun dev:api
# -> http://localhost:3001

# Terminal 2: Start frontend (Vite dev server, proxies /api → :3001)
bun dev
# -> http://localhost:5173
```

### Testing

```bash
bun test                 # all packages
bun run test:api         # API only
bun run test:web         # web only
bun run test:shared      # shared only
```

### Type Checking

```bash
bun run typecheck
```

### Lint & Format

```bash
bun run check            # lint + auto-fix
bun run lint             # lint only
bun run format           # format only
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build

# App (UI + API) -> http://localhost:38700
```

Two services come up: `app` (serves the SPA + `/api`) and `cobalt` (internal-only).

### Production environment variables

```bash
# Optional — restrict cross-origin API callers. The same-origin SPA needs none.
ALLOWED_ORIGINS=https://snatch.example.com

# Internal cobalt instance (docker-compose sets this automatically).
COBALT_API_URL=http://cobalt:9000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/download?url=...` | Resolve via cobalt and stream the media file |
| GET | `/health` | Health check |

## Environment Variables

| Variable | Service | Description | Default |
|----------|---------|-------------|---------|
| `APP_PORT` | app | Host port for the UI + API | `38700` |
| `ALLOWED_ORIGINS` | app | Cross-origin API callers (comma-separated) | `""` (reject all) |
| `PORT` | app | Container listen port | `3001` |
| `API_RATE_LIMIT_MAX` | app | Max API requests per window | `30` |
| `API_RATE_LIMIT_WINDOW` | app | Rate window (ms) | `60000` |
| `COBALT_API_URL` | app | Internal self-hosted cobalt instance URL | `http://localhost:9000` |
| `VITE_API_TARGET` | web (dev) | Vite dev proxy target for `/api` | `http://localhost:3001` |

## Architecture

```
Browser ─ GET / ────────────▶ snatch-app (Hono, serves the SPA static files)
Browser ─ GET /api/download ─▶ snatch-app
                                    │  validate → rate limit
                                    │  resolve via cobalt → fetch → pipe bytes back
                                    ▼
                              cobalt (self-hosted, internal-only, port 9000)
                                    │  tunnel / redirect
                                    ▼
                              source CDN / cobalt tunnel
```

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 19, Vite, Tailwind CSS 4 |
| API | Bun, Hono |
| Media engine | cobalt (self-hosted) |
| Shared | TypeScript types, validation, constants |
| Tooling | Bun workspaces, Biome, Husky |

## License

MIT
