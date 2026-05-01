# Code Quality Fixes Design

## Goal

Fix the project-wide quality issues found in review, prioritizing security, subprocess lifecycle correctness, validation consistency, deployment configuration, accessibility, and focused test coverage.

## Scope

This work covers all reviewed findings:

- Web download proxy validation and rate-limit bypasses.
- Spoofable client identity for rate limiting.
- URL platform detection and validation inconsistencies.
- `yt-dlp` stdout/stderr deadlock risk and download stream error handling.
- Request body size enforcement gaps.
- Docker web rate-limit environment wiring.
- Malformed JSON handling in the API.
- Cache LRU behavior mismatch.
- Accessibility gaps in the downloader input and error UI.
- Missing tests for the highest-risk flows.

## Architecture

The existing package boundaries remain unchanged:

- `packages/shared` owns URL/platform validation, sanitization helpers, and shared types.
- `packages/web` owns browser-facing validation, rate limiting, SSR proxying, and React UI.
- `packages/api` owns Hono routes, cache, and `yt-dlp` process integration.

No new runtime dependency is required. The shared package stays dependency-free.

## Validation Contract

`detectPlatform()` will parse URLs with `new URL()` and match only the normalized hostname. It will reject spoofed URLs such as `https://evil.com/x.com/user/status/123` instead of matching platform strings anywhere in the URL.

`validate()` and `validateUrl()` will use the same host allowlist semantics so web and API validation cannot drift. X/Twitter URLs remain strict and must include a status ID. TikTok canonical video URLs should extract IDs when present. TikTok short/share hosts may be accepted without a content ID because yt-dlp can resolve those redirects.

`sanitizeUrl()` will reject non-HTTP(S) protocols using an allowlist rather than a protocol denylist.

## Web Proxy Security

`POST /api/download` keeps its extraction flow but enforces the 10KB body limit even when `Content-Length` is missing. The implementation should read text first with a bounded strategy, then parse JSON.

`GET /api/download` will apply the same URL validation and rate limiting as `POST` before proxying to the API. This prevents clients from bypassing web-layer protections by calling generated download links directly.

`getClientId()` will stop blindly trusting user-supplied forwarding headers. It should prefer a deployment-controlled source when available and otherwise fall back to a conservative request-derived key. Any remaining proxy assumptions must be documented in code or `AGENTS.md` only if future agents need them.

## API Process And Streaming Lifecycle

`extractVideoInfo()` will read stdout and stderr concurrently while awaiting process exit. This prevents child-process deadlock when `yt-dlp --dump-json` writes enough output to fill a pipe buffer.

`downloadVideoStream()` will avoid unbounded buffering by respecting stream backpressure. It will also track process completion and stderr so non-zero exits do not silently become successful empty or truncated downloads when the failure can still be reported.

Cancellation and timeout paths must kill the subprocess and release readers.

## Runtime Configuration

Docker Compose will pass `PUBLIC_RATE_LIMIT_MAX` and `PUBLIC_RATE_LIMIT_WINDOW` into the web container because Astro/Vite reads public runtime config through `import.meta.env` keys with the `PUBLIC_` prefix.

Existing API environment variables remain unchanged unless implementation discovers unused variables that should be removed from docs/config as part of the same focused cleanup.

## Cache Behavior

The cache will match its stated LRU behavior. `get()` should refresh recency, and eviction should remove the least-recently-used non-expired entry. Expired entries should still be removed before normal eviction where practical.

## Accessibility

The downloader URL input will get a persistent accessible name via label or `aria-label`.

Dynamic error messages will use `role="alert"` or an `aria-live` region so assistive technology announces validation/API failures.

## Error Handling

Malformed JSON sent to API extraction routes will return a deterministic `400` JSON response instead of bubbling into a generic server error.

Web proxy JSON parsing and upstream failure handling should preserve existing user-facing messages unless a clearer error is necessary.

## Testing

Add focused unit tests rather than broad integration infrastructure:

- Shared validation rejects spoofed hosts and unsupported protocols.
- Shared validation rejects YouTube and unsupported domains.
- Shared validation accepts supported X/Twitter and TikTok URL shapes, including TikTok short/share URLs if supported by the final implementation.
- Web middleware covers client ID behavior and validation edge cases.
- Web API route tests cover GET validation/rate limiting and POST body-size enforcement where practical.
- API route tests cover malformed JSON.
- Extractor tests cover non-zero exit and stdout/stderr lifecycle using mocks or small spawned commands if practical.
- Cache tests cover true LRU refresh-on-get behavior.

## Verification

Run these commands before considering implementation complete:

```bash
bun test
bun typecheck
bun lint
```

Use package-specific commands while iterating:

```bash
bun test:shared
bun test:web
bun test:api
```

## Out Of Scope

- Adding a persistent distributed rate limiter.
- Replacing yt-dlp.
- Adding new supported platforms.
- Introducing new runtime dependencies unless a current platform API makes a fix impractical without one.
