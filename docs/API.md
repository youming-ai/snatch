# Snatch API Documentation

## Overview

Snatch provides a RESTful API for extracting and downloading media from social media platforms.

**Base URL:** 
- Development: `http://localhost:3001`
- Production: Set via `RUST_API_URL` environment variable

---

## Endpoints

### 1. Extract Media Information

Extract downloadable media URLs from a social media post.

**Endpoint:** `POST /api/extract`

**Request:**
```json
{
  "url": "https://www.tiktok.com/@username/video/1234567890"
}
```

**Response (Success):**
```json
{
  "success": true,
  "platform": "tiktok",
  "title": "Video Title",
  "thumbnail": "https://...",
  "formats": [
    {
      "quality": "1080p",
      "url": "https://...",
      "ext": "mp4",
      "filesize": 12345678
    },
    {
      "quality": "720p",
      "url": "https://...",
      "ext": "mp4",
      "filesize": 8765432
    }
  ]
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid URL or unsupported platform |
| 500 | Extraction failed |

---

### 2. Download Media

Stream download the media file directly.

**Endpoint:** `GET /api/download`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Original social media URL |

**Example:**
```
GET /api/download?url=https://www.tiktok.com/@username/video/1234567890
```

**Response:**
- Content-Type: `video/mp4`
- Content-Disposition: `attachment; filename="video.mp4"`
- Body: Binary video stream

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | Success, streaming video |
| 500 | Download failed |

---

### 3. Health Check

Check if the API service is running.

**Endpoint:** `GET /health`

**Response:**
```
OK
```

**Status Codes:**
| Code | Description |
|------|-------------|
| 200 | Service is healthy |

---

## Supported Platforms

| Platform | Domain Patterns | Video | Image | Notes |
|----------|-----------------|-------|-------|-------|
| TikTok | `tiktok.com` | ✅ | ❌ | No watermark |
| Instagram | `instagram.com` | ✅ | ✅ | Reels, Posts, IGTV |
| X (Twitter) | `twitter.com`, `x.com` | ✅ | ✅ | Videos, GIFs |

---

## Frontend API Proxy

The Astro frontend provides a proxy endpoint that adds rate limiting and validation.

**Endpoint:** `POST /api/download`

**Request:**
```json
{
  "url": "https://www.tiktok.com/@username/video/1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "tiktok-1703123456789-0",
      "type": "video",
      "url": "https://...",
      "thumbnail": "https://...",
      "downloadUrl": "http://localhost:3001/api/download?url=...",
      "title": "Video Title",
      "size": "12.3 MB",
      "platform": "tiktok",
      "quality": "hd",
      "isMock": false
    }
  ],
  "platform": "tiktok"
}
```

**Rate Limiting Headers:**
| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Timestamp when the window resets |
| `Retry-After` | Minutes until rate limit resets (on 429) |

**Error Response (Rate Limited):**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again in 1 minute."
}
```
Status: `429 Too Many Requests`

---

## Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `URL is required` | Empty URL field | Provide a valid URL |
| `Invalid URL format` | Malformed URL | Check URL syntax |
| `Unsupported platform` | URL not from supported platform | Use TikTok, Instagram, or X |
| `Failed to extract download links` | yt-dlp extraction failed | Try a different post |
| `Download service unavailable` | Rust API not running | Start the API service |
| `Rate limit exceeded` | Too many requests | Wait and try again |

---

## Development

### Running Locally

```bash
# Start Rust API
cd downloader-api
cargo run

# Or with Docker
docker build -t downloader-api .
docker run -p 3001:3001 downloader-api
```

### Testing with cURL

```bash
# Extract
curl -X POST http://localhost:3001/api/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.tiktok.com/@username/video/123"}'

# Health check
curl http://localhost:3001/health
```

---

## Security Considerations

1. **CORS**: Configure `ALLOWED_ORIGINS` in production
2. **Rate Limiting**: 10 requests per minute per client by default
3. **Input Validation**: URLs are validated before processing
4. **XSS Prevention**: Response data is sanitized

---

## Changelog

### v1.0.0
- Initial release
- Support for TikTok, Instagram, X (Twitter)
- Rate limiting
- Docker deployment
