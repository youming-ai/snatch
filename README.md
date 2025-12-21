# Snatch

A fast, lightweight social media video downloader powered by Rust + yt-dlp.

## Features

- 🚀 **Fast** - Rust backend with yt-dlp for efficient downloads
- 🎯 **Simple** - Just paste a URL and click download
- 🔒 **Private** - No data stored, no accounts required
- 🐳 **Docker Ready** - One-command deployment

## Supported Platforms

| Platform | Video | Image |
|----------|-------|-------|
| TikTok | ✅ | ✅ |
| X (Twitter) | ✅ | ✅ |
| Instagram | ✅ | ⚠️ |

## Quick Start

### Development

```bash
# Start API (Docker)
docker compose up api -d

# Start frontend
bun install
bun dev
```

### Production

```bash
# One-command deployment
docker compose up -d --build
```

## Project Structure

```
snatch/
├── src/                    # Astro frontend
│   ├── components/         # React components
│   ├── pages/              # Pages & API routes
│   ├── lib/                # Utilities
│   └── styles.css          # Global styles
├── snatch-rs/              # Rust API backend
│   └── src/                # Rust source
├── docker-compose.yml      # Docker orchestration
├── Dockerfile              # Frontend container
└── docs/                   # Documentation
    └── API.md              # API documentation
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Astro Frontend │────▶│  Rust API       │
│  (SSR + Bun)    │     │  (snatch-rs)    │
│  Port: 4321     │     │  Port: 3001     │
└─────────────────┘     └─────────────────┘
```

## Tech Stack

- **Frontend**: Astro + React + Tailwind CSS v4
- **Backend**: Rust (Axum) + yt-dlp
- **Package Manager**: Bun
- **Deploy**: Docker Compose

## Scripts

```bash
bun dev       # Start development server
bun build     # Build for production
bun test      # Run tests
bun lint      # Lint and fix code
```

## Documentation

- [API Documentation](./docs/API.md)
- [Deployment Guide](./DEPLOY.md)

## License

MIT