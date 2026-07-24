# Snatch

Social media video downloader — Bun monorepo: a React + Vite SPA served by a Hono API powered by a native `yt-dlp` engine.

## Supported Platforms

| Platform | Video |
|----------|-------|
| X | ✅ |
| TikTok | ✅ |
| Instagram | ✅ |
| YouTube | ❌ (removed) |

## Project Structure

```
snatch/
├── packages/
│   ├── api/                # Bun + Hono API server
│   │   ├── src/
│   │   │   ├── routes/     # /health, /api/resolve, /api/download
│   │   │   └── lib/        # ytdlp, security
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
- `ffmpeg` installed on system

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

## Deployment

Two supported topologies.

### All-in-one (Docker / Dokploy) — recommended

The API serves the built SPA and `/api/*` on one origin. This is the only tier
that runs the yt-dlp engine (it needs `child_process` + a filesystem, so it
cannot run on Cloudflare Workers/Pages).

```bash
cp .env.example .env
docker compose up -d --build
# App (UI + API) -> http://localhost:38700
```

On Dokploy: point the app's domain at the `app` service (port `3001`).

### Split origin (Cloudflare Pages frontend + Dokploy API)

Host the static SPA on Cloudflare Pages and keep the API on Dokploy.

1. **API (Dokploy)** — deploy the Docker image as above and set
   `ALLOWED_ORIGINS` to the Pages origin (e.g. `https://snatch.pages.dev`) so
   the browser may call `/api/resolve` cross-origin.
2. **Frontend (Cloudflare Pages)** — connect the repo and set the build env
   `VITE_API_BASE_URL` to the public API origin (e.g. `https://api.snatch.example`).
   Then choose ONE deploy mechanism:
   - **Git integration (recommended, zero-secret):** Build command
     `bun run build:cf`, Build output directory `packages/web/dist`, and leave
     the **Deploy command empty**. Cloudflare publishes the output itself.
   - **Wrangler deploy command:** Build command `bun run build:cf`, Deploy
     command `bun run deploy:cf`. This runs `wrangler pages deploy` and
     **requires** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the
     build env, plus a Pages project named `snatch` (adjust `--project-name`
     in the script otherwise).

Downloads stream directly from the API origin via `Content-Disposition`, so
only `/api/resolve` needs CORS.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/resolve` | Extract video information and available resolution choices via yt-dlp |
| GET | `/api/download` | Execute download for chosen format and stream bytes back |
| GET | `/api/info` | Query engine status |
| GET | `/health` | Health check |

## License

MIT
