# Cloudflare Deployment Configuration

## Overview
This document explains the Cloudflare Pages deployment setup for the Instagram/TikTok/Twitter downloader application.

## Changes Made

### 1. Created `wrangler.jsonc`
A Wrangler configuration file was created to enable deployment to Cloudflare Pages/Workers:

```json
{
  "name": "ins-x-tiktok-downloader",
  "compatibility_date": "2025-11-26",
  "main": "./dist/server/server.js",
  "site": {
    "bucket": "./dist/client"
  },
  "compatibility_flags": ["nodejs_compat"]
}
```

**Key Configuration:**
- `main`: Points to the server-side bundle built by TanStack Start
- `site.bucket`: Specifies the directory containing static client assets
- `compatibility_flags`: Enables Node.js compatibility for server-side features

### 2. Updated README.md
Added comprehensive deployment instructions including:
- Wrangler CLI installation
- Authentication steps
- Build and deployment commands
- Important notes about platform limitations

## Deployment Process

### Local Testing
```bash
pnpm build
```

This creates:
- `dist/client/` - Static assets (HTML, CSS, JS)
- `dist/server/` - Server-side bundle for SSR

### Deploy to Cloudflare
```bash
# First time setup
wrangler login

# Deploy
npx wrangler deploy
```

## Platform Considerations

### What Works
✅ Server-side rendering (SSR)
✅ API routes
✅ Static asset serving
✅ Instagram GraphQL API integration
✅ Native HTTP-based downloaders

### Limitations on Cloudflare Workers
⚠️ **Puppeteer/Crawlee**: Not supported on Cloudflare Workers
- The application is designed to gracefully fall back to alternative methods
- Mock data will be shown when browser automation is unavailable
- Consider using Cloudflare Browser Rendering API for future enhancements

### Recommended Approach
For production use with full Puppeteer/Crawlee support, consider:
1. **Cloudflare Pages + External API**: Deploy the frontend to Cloudflare Pages, but use a separate Node.js server (e.g., on Railway, Render, or Fly.io) for browser automation
2. **Hybrid Architecture**: Use Cloudflare for the main app and native downloaders, with fallback to an external service for complex scraping
3. **Cloudflare Browser Rendering**: Explore Cloudflare's Browser Rendering API as an alternative to Puppeteer

## Instagram Download Implementation

### GraphQL Strategy
The Instagram downloader now includes a GraphQL API strategy based on the `Okramjimmy/Instagram-reels-downloader` implementation:

- **Endpoint**: `https://www.instagram.com/api/graphql`
- **Doc ID**: `10015901848480474`
- **Headers**: Includes `X-IG-App-ID`, `X-FB-LSD`, `X-ASBD-ID`, etc.

### Fallback Chain
1. Enhanced web scraping (parsing `__NEXT_DATA__`, `_sharedData`)
2. **GraphQL API** (new implementation)
3. Alternative APIs (oEmbed, embed endpoints)
4. Mock data (with clear indicators)

### Current Status
The GraphQL API returns `null` for media data when called without authenticated session cookies. This is expected behavior due to Instagram's anti-bot protections. The application handles this gracefully by falling back to other methods.

## Next Steps

To improve Instagram download success rate:
1. Implement cookie rotation/management
2. Add proxy support
3. Consider using authenticated Instagram API (requires user login)
4. Explore Cloudflare Browser Rendering API for server-side scraping

## Testing

Before deploying, always test locally:
```bash
pnpm build
pnpm serve
```

This ensures the production build works correctly before deployment.
