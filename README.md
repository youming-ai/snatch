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
pnpm install
pnpm dev
```

### Production

```bash
# One-command deployment
docker compose up -d --build
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Astro Frontend │────▶│  Rust API       │
│  (SSR)          │     │  + yt-dlp       │
│  Port: 4321     │     │  Port: 3001     │
└─────────────────┘     └─────────────────┘
```

## Tech Stack

- **Frontend**: Astro + React + Tailwind CSS
- **Backend**: Rust (Axum) + yt-dlp
- **Deploy**: Docker Compose

## License

MIT