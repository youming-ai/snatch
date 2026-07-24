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

## Docker

```bash
cp .env.example .env
docker compose up -d --build

# App (UI + API) -> http://localhost:38700
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/resolve` | Extract video information and available resolution choices via yt-dlp |
| GET | `/api/download` | Execute download for chosen format and stream bytes back |
| GET | `/api/info` | Query engine status |
| GET | `/health` | Health check |

## License

MIT
