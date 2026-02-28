# Snatch Backend

High-performance social media video downloader API - Built with Rust + yt-dlp.

## Features

- 🚀 **Fast** - Rust-powered with Axum framework
- 📦 **All-in-One** - Includes yt-dlp for media extraction
- 🔒 **Secure** - Built-in rate limiting and CORS protection
- 🐳 **Docker Ready** - Single container deployment
- 📊 **Cached** - Smart caching with TTL support

## Supported Platforms

| Platform | Video | Image |
|----------|-------|-------|
| TikTok | ✅ | ✅ |
| X (Twitter) | ✅ | ✅ |
| Instagram | ✅ | ⚠️ |

## Quick Start

### Using Docker (Recommended)

```bash
# Build image
docker build -t snatch-backend snatch-rs/

# Run container
docker run -d \
  --name snatch-backend \
  -p 38701:3001 \
  -e ALLOWED_ORIGINS=https://your-frontend.com \
  --restart always \
  snatch-backend

# Check health
curl http://localhost:38701/health
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: snatch-rs/Dockerfile
    container_name: snatch-backend
    ports:
      - "38701:3001"
    environment:
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-}
      - RUST_LOG=${RUST_LOG:-info}
      - RATE_LIMIT_MAX=${RATE_LIMIT_MAX:-10}
    restart: unless-stopped
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Then run:

```bash
# Create .env from example
cp .env.example .env

# Edit .env and configure ALLOWED_ORIGINS

# Start service
docker compose up -d --build
```

### Local Development (Requires Rust)

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install yt-dlp
pip install yt-dlp
# or
brew install yt-dlp

# Run
cd snatch-rs
cargo run --release
```

## API Endpoints

### Health Check
```bash
GET /health
Response: "OK"
```

### Extract Video Info
```bash
POST /api/extract
Content-Type: application/json

{
  "url": "https://www.tiktok.com/@user/video/123"
}

Response:
{
  "success": true,
  "platform": "tiktok",
  "title": "Video Title",
  "thumbnail": "https://...",
  "formats": [
    {
      "format_id": "0",
      "ext": "mp4",
      "quality": "720p",
      "url": "https://...",
      "size": 12345678
    }
  ]
}
```

See [docs/API.md](./docs/API.md) for full API documentation.

## Environment Variables

| Variable | Description | Default | Production |
|----------|-------------|---------|------------|
| `ALLOWED_ORIGINS` | CORS allowed origins | All origins | Set to your frontend domain |
| `RUST_LOG` | Log level | `info` | `info` or `warn` |
| `PORT` | Server port | `3001` | `3001` |
| `RATE_LIMIT_MAX` | Requests per minute | `10` | `10` |
| `RATE_LIMIT_WINDOW` | Rate window (ms) | `60000` | `60000` |

## Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:38701;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Tech Stack

- **Language**: Rust
- **Framework**: Axum (Tokio)
- **Downloader**: yt-dlp
- **Deployment**: Docker

## Project Structure

```
snatch/
├── snatch-rs/
│   ├── src/
│   │   ├── main.rs      # Entry point
│   │   ├── handlers.rs  # API endpoints
│   │   ├── models.rs    # Data models
│   │   ├── cache.rs     # Caching logic
│   │   ├── extractor.rs # yt-dlp integration
│   │   ├── validation.rs # URL validation
│   │   └── retry.rs     # Retry logic
│   ├── Cargo.toml
│   └── Dockerfile
└── docs/
    └── API.md           # API documentation
```

## Security

- **CORS**: Configure `ALLOWED_ORIGINS` in production
- **Rate Limiting**: Default 10 requests/minute per IP
- **Input Validation**: URL sanitization and pattern matching
- **No Data Storage**: No logs or user data persisted

## Monitoring

```bash
# View logs
docker logs -f snatch-backend

# Check health
curl http://localhost:38701/health
```

## Frontend

This API is designed to work with the [Snatch Frontend](https://github.com/youming-ai/snatch-frontend).

## License

MIT
