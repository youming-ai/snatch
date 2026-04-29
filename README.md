# Snatch

Social media video downloader — Bun monorepo with Hono API and Astro frontend.

## Supported Platforms

| Platform | Video | Image |
|----------|-------|-------|
| TikTok | ✅ | ✅ |
| X (Twitter) | ✅ | ✅ |
| Instagram | ✅ | ⚠️ |

## Project Structure

```
snatch/
├── packages/
│   ├── api/                # Bun + Hono API (yt-dlp)
│   ├── web/                # Astro + React frontend
│   └── shared/             # Shared types, constants, validation
├── docker-compose.yml
├── package.json            # Bun workspace root
└── .env.example
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (for local API dev)

### Install

```bash
bun install
```

### Development

```bash
# Terminal 1: Start API
bun dev:api
# -> http://localhost:3001

# Terminal 2: Start frontend
bun dev
# -> http://localhost:4321
```

### Docker

```bash
cp .env.example .env
docker compose up -d --build
# API -> http://localhost:38701
```

### Testing

```bash
bun test
```

### Lint & Format

```bash
bun run check
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/extract` | Extract video info |
| GET | `/api/download?url=...` | Stream video download |
| GET | `/health` | Health check |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | Backend API URL (frontend) | `http://localhost:3001` |
| `ALLOWED_ORIGINS` | CORS origins (API) | All origins |
| `PORT` | API server port | `3001` |
| `RATE_LIMIT_MAX` | Requests per window | `10` |
| `RATE_LIMIT_WINDOW` | Rate window (ms) | `60000` |

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Astro 5, React 19, Tailwind CSS 4 |
| API | Bun, Hono |
| Extraction | yt-dlp |
| Shared | TypeScript types + validation |
| Tooling | Bun, Biome, Husky |

## License

MIT
