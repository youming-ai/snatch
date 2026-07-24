/**
 * Base URL of the API origin. Empty means same-origin — the all-in-one Docker
 * image (API serves this SPA) and local dev (Vite proxies `/api`) both leave
 * it unset. In the split deployment the SPA is hosted on Cloudflare Pages and
 * this is baked to the public API origin at build time via `VITE_API_BASE_URL`.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
