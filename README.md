# Snatch

Social media video downloader — Bun monorepo with Hono API and Astro frontend.

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
│   │   │   ├── routes/     # /health, /api/extract, /api/download
│   │   │   └── lib/        # Cache, extractor, retry
│   │   └── test/
│   ├── web/                # Astro 5 + React 19 frontend
│   │   ├── src/
│   │   │   ├── components/ # DownloaderApp, DownloaderInput, DownloadResult
│   │   │   ├── middleware/ # Rate limiting, security validation
│   │   │   ├── pages/      # index.astro, api/download.ts
│   │   │   └── types/
│   │   └── public/
│   └── shared/             # Types, validation, constants (zero deps)
│       └── src/
├── docker-compose.yml
├── package.json            # Bun workspace root
└── .env.example
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) >= 1.3
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (for local API dev; Docker image includes it)

### Install

```bash
bun install
```

### Development

```bash
# Terminal 1: Start API (hot reload)
bun dev:api
# -> http://localhost:3001

# Terminal 2: Start frontend (hot reload)
bun dev
# -> http://localhost:4321
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

# API  -> http://localhost:38701
# Web  -> http://localhost:38700
```

The web service depends on the API being healthy. Startup order is handled automatically.

### Production environment variables

```bash
# Required for production — used in download links returned to browsers.
# Must be the API's public HTTPS URL (e.g., https://api.example.com).
API_URL_PUBLIC=https://api.example.com

# CORS — set to the web app's public URL in production.
ALLOWED_ORIGINS=https://snatch.example.com
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/extract` | Extract media metadata from a social URL |
| GET | `/api/download?url=...` | Stream video download (pipe-through from yt-dlp) |
| GET | `/health` | Health check |

## Environment Variables

| Variable | Service | Description | Default |
|----------|---------|-------------|---------|
| `API_URL` | Web | API URL for local dev (`bun dev`) | `http://localhost:3001` |
| `API_URL_INTERNAL` | Web | SSR-to-API internal URL (container network) | `http://api:3001` |
| `API_URL_PUBLIC` | Web | API public origin for browser download links | `http://localhost:38701` |
| `ALLOWED_ORIGINS` | API | CORS origins (comma-separated) | `""` (all) |
| `PORT` | Both | Server listen port | `3001` (API), `4321` (Web) |
| `RATE_LIMIT_MAX` | API | Max requests per window | `10` |
| `RATE_LIMIT_WINDOW` | API | Rate window (ms) | `60000` |

## Architecture

```
Browser → snatch-web (Astro SSR, port 4321)
                │
                │  POST /api/download
                │  validate → rate limit → forward
                ▼
          snatch-api (Hono, port 3001)
                │
                │  POST /api/extract
                │  validate → cache → retry → yt-dlp
                ▼
          yt-dlp (media extraction engine)

Download flow (browser clicks download link):
  Browser ──GET /api/download?url=...──▶ snatch-api ──yt-dlp pipe-through──▶ video.mp4
```

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Astro 5, React 19, Tailwind CSS 4 |
| API | Bun, Hono |
| Extraction | yt-dlp |
| Shared | TypeScript types, validation, constants |
| Tooling | Bun workspaces, Biome, Husky |

## License

MIT
