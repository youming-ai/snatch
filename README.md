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
# Install dependencies
bun install

# Start API (Docker)
docker compose up api -d

# Start frontend
bun dev
```

### Production

#### Option 1: Cloudflare Pages + Docker Backend ⭐ (Recommended)

**Frontend on Cloudflare Pages, Backend on Docker**

```bash
# Backend: Start API with Docker
git clone <your-repo-url>
cd snatch
docker compose up api -d --build
# Or configure Cloudflare Tunnel for secure access

# Frontend: Deploy to Cloudflare Pages
# 1. Configure environment variables in Cloudflare dashboard:
#    RUST_API_URL=https://your-api-domain.com
# 2. Switch to Cloudflare adapter:
cp astro.config.cloudflare.mjs astro.config.mjs
# 3. Connect Git repo and deploy
```

**See [DEPLOY.md](./DEPLOY.md#方案-bcloudflare-pages--docker-后端推荐) for detailed instructions.**

#### Option 2: Docker Compose (Complete Setup)

```bash
# Clone and enter directory
git clone <your-repo-url>
cd snatch

# Configure environment
cp .env.production.example .env
# Edit .env and set your domain

# Deploy
docker compose up -d --build
```

#### Option 3: With Nginx Reverse Proxy

```bash
# 1. Deploy with Docker Compose
docker compose up -d --build

# 2. Install Nginx and Certbot
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# 3. Copy Nginx config
sudo cp nginx.conf.example /etc/nginx/sites-available/snatch
# Edit the file and replace 'your-domain.com'

# 4. Enable site and get SSL certificate
sudo ln -s /etc/nginx/sites-available/snatch /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.com

# 5. Restart Nginx
sudo systemctl restart nginx
```

#### Option 4: One-Click Deployment Script

```bash
chmod +x deploy.sh
./deploy.sh
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
- [Cloudflare Pages + Docker Deployment](./CLOUDFLARE.md) ⭐

## Environment Variables

Copy `.env.production.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `RUST_API_URL` | Rust API service URL | `http://api:3001` |
| `ALLOWED_ORIGINS` | CORS allowed origins (production) | (empty) |
| `RUST_LOG` | Log level (error/warn/info/debug) | `info` |
| `PORT` | Frontend port (internal) | `4321` |
| `RATE_LIMIT_MAX` | Max requests per minute | `10` |

**Note**: Default exposed ports are **38702** (frontend) and **38701** (API).

## Deployment Checklist

- [ ] Copy `.env.production.example` to `.env`
- [ ] Set `ALLOWED_ORIGINS` to your domain
- [ ] Configure firewall (open ports 80, 443)
- [ ] Set up Nginx reverse proxy (optional but recommended)
- [ ] Obtain SSL certificate with Let's Encrypt
- [ ] Test health endpoints: `/health` and API `/api/health`

## Production Tips

1. **Security**: Always use HTTPS and set `ALLOWED_ORIGINS`
2. **Monitoring**: Check logs with `docker compose logs -f`
3. **Updates**: Update with `git pull && docker compose up -d --build`
4. **Backups**: No persistent data needed, but keep config files backed up

## License

MIT