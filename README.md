# Snatch

Social media video downloader — Astro + React frontend with Rust API backend, organized as a Bun monorepo.

## Supported Platforms

| Platform | Video | Image |
|----------|-------|-------|
| TikTok | ✅ | ✅ |
| X (Twitter) | ✅ | ✅ |
| Instagram | ✅ | ⚠️ |

## Project Structure

```
snatch/
├── apps/
│   ├── api/                # Rust backend (Axum + yt-dlp)
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── handlers.rs
│   │   │   ├── models.rs
│   │   │   ├── cache.rs
│   │   │   ├── extractor.rs
│   │   │   ├── validation.rs
│   │   │   └── retry.rs
│   │   ├── Cargo.toml
│   │   └── Dockerfile
│   │
│   └── web/                # Astro + React frontend
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   ├── lib/
│       │   ├── middleware/
│       │   ├── config/
│       │   ├── types/
│       │   └── constants/
│       ├── public/
│       └── package.json
│
├── docs/
├── docker-compose.yml
├── package.json            # Bun workspace root
└── .env.example
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (package manager)
- [Rust](https://www.rust-lang.org/tools/install) (for API, or use Docker)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (for API local dev)

### Install Dependencies

```bash
bun install
```

### Development

**Frontend only** (with Docker API):

```bash
# Start API in Docker
docker compose up api -d

# Start frontend dev server
bun dev
# -> http://localhost:4321
```

**Full local development**:

```bash
# Terminal 1: Start Rust API
cd apps/api
cargo run
# -> http://localhost:3001

# Terminal 2: Start frontend
echo "RUST_API_URL=http://localhost:3001" > .env
bun dev
# -> http://localhost:4321
```

**Full Docker** (production-like):

```bash
cp .env.example .env
# Edit .env as needed

docker compose up -d --build
# API -> http://localhost:38701
```

### Testing

```bash
# Frontend tests
bun test

# Backend tests
cd apps/api && cargo test
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/extract` | Extract video info (formats, title, thumbnail) |
| GET | `/api/download?url=...` | Stream video download |
| GET | `/health` | Health check |

See [docs/README.md](./docs/README.md) for full API documentation.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RUST_API_URL` | Backend API URL (frontend) | `http://localhost:38701` |
| `ALLOWED_ORIGINS` | CORS origins (API) | All origins |
| `PORT` | API server port | `3001` |
| `RUST_LOG` | Log level | `info` |
| `RATE_LIMIT_MAX` | Requests per minute | `10` |
| `RATE_LIMIT_WINDOW` | Rate window (ms) | `60000` |

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Astro 5, React 19, Tailwind CSS 4 |
| Backend | Rust, Axum, Tokio |
| Extraction | yt-dlp |
| Deployment | Docker, Cloudflare Pages (frontend) |
| Tooling | Bun, Biome, Husky |

## License

MIT
