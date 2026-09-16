# Security Policy

## Supported Versions

Only the `main` branch receives security updates.

## Reporting a Vulnerability

Please **do not** open a public issue.

Email `youmin.tang@elestyle.jp` with a description, reproduction steps, and impact.
You will receive an acknowledgement within 48 hours. If you do not, please open a minimal GitHub issue stating that you sent a security report (without details).

We will coordinate a fix and disclosure timeline with you.

## Scope & Notes

- `validateUrl()` in `packages/shared` rejects private / loopback / link-local / single-label hosts, but it is a literal-hostname check only — it does not resolve DNS and cannot stop DNS rebinding or redirects that `yt-dlp` may follow. Do not expose the API to untrusted networks without additional network-level egress controls if that is a concern.
- Download URLs are HMAC-SHA256 signed (`PROXY_SIGNING_KEY`). Set a stable `PROXY_SIGNING_KEY` in production so signatures survive restarts; otherwise links are invalidated on restart by design. A signature authorises an operation, not a user, so treat a `progress` or `download` URL as a bearer credential while it is valid.
- When `API_KEY` is set, `/api/*` requires `Authorization: Api-Key <value>`. Leave it unset only for public / local instances.
- `YTDLP_COOKIES_FILE` is the one place a credential is expected to live. A jar exported from a browser is a live account session: store it outside the image, mount it read-only, and treat it like a password (rotate it by logging the account out). Prefer a throwaway account, and note that whoever can read the file can act as that account on the sites it covers.
- Rate limiting is in-memory and per process. It identifies callers by `cf-connecting-ip`, `fly-client-ip`, or the header named in `API_IP_HEADER`. Behind any other reverse proxy that variable must be set to a header the proxy overwrites (for Nginx, `x-real-ip`); without it, callers are bucketed by user agent and unrelated users share one budget. `x-forwarded-for` is not trusted unconfigured because callers can append to it. Multiple replicas multiply the effective limit, since each keeps its own counters.
- Prepared media and probe metadata are written to the system temp directory and reclaimed on a TTL (2 hours, capped at 4 GB). On a host that shares `/tmp` with other tenants, point the service at a private temp directory or volume.
