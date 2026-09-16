import type { MiddlewareHandler } from "hono";
import { env } from "hono/adapter";

interface RateLimitOptions {
	maxRequests: number;
	windowMs: number;
}

interface ClientData {
	count: number;
	resetTime: number;
}

const clients = new Map<string, ClientData>();

// Drop expired buckets so `clients` cannot grow without bound. Unref'd, so the
// timer is never the reason the process stays alive.
const pruneTimer = setInterval(
	() => {
		const now = Date.now();
		for (const [id, data] of clients.entries()) {
			if (now > data.resetTime) clients.delete(id);
		}
	},
	5 * 60 * 1000,
);
pruneTimer.unref();

export function clearClients(): void {
	clients.clear();
}

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16);
}

/**
 * Headers trusted for the caller's address. `cf-connecting-ip` and
 * `fly-client-ip` are written by those platforms' edge; `API_IP_HEADER` lets
 * any other reverse proxy name the header it sets (Nginx's `x-real-ip`, say).
 *
 * `x-forwarded-for` is not trusted unless configured: it is a caller-appendable
 * list, so an unconfigured server that believed it would let one client pick a
 * fresh bucket per request and never meet the limit.
 */
const BUILT_IN_IP_HEADERS = ["cf-connecting-ip", "fly-client-ip"];

function trustedIpHeaders(configured: string | undefined): string[] {
	const header = configured?.trim().toLowerCase();
	return header ? [header, ...BUILT_IN_IP_HEADERS] : BUILT_IN_IP_HEADERS;
}

/** Proxies may hand back a comma-separated chain; bucket on the first hop. */
function firstAddress(value: string): string {
	return value.split(",")[0]?.trim() ?? "";
}

function getClientId(
	c: { req: { header: (name: string) => string | undefined } },
	ipHeaders: string[],
): string {
	for (const header of ipHeaders) {
		const value = c.req.header(header);
		if (value) {
			const address = firstAddress(value);
			if (address) return simpleHash(`ip:${address}`);
		}
	}

	// Last resort. Every caller that shares a user agent — one Chrome version,
	// every bot — shares this bucket, so a reverse proxy in front of the API
	// should always provide one of the headers above.
	const userAgent = c.req.header("user-agent") || "unknown-agent";
	return simpleHash(`fallback:${userAgent}`);
}

/** A non-positive or unparseable value must not silently disable the limit. */
function readPositiveInt(value: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function rateLimit(options?: Partial<RateLimitOptions>): MiddlewareHandler {
	return async (c, next) => {
		const envVars = env(c);
		const maxRequests =
			options?.maxRequests ?? readPositiveInt(envVars.API_RATE_LIMIT_MAX as string | undefined, 30);
		const windowMs =
			options?.windowMs ??
			readPositiveInt(envVars.API_RATE_LIMIT_WINDOW as string | undefined, 60_000);
		const clientId = getClientId(c, trustedIpHeaders(envVars.API_IP_HEADER as string | undefined));
		const now = Date.now();
		const clientData = clients.get(clientId);

		if (!clientData || now > clientData.resetTime) {
			clients.set(clientId, { count: 1, resetTime: now + windowMs });
			c.header("X-RateLimit-Limit", maxRequests.toString());
			c.header("X-RateLimit-Remaining", (maxRequests - 1).toString());
			c.header("X-RateLimit-Reset", (now + windowMs).toString());
			await next();
			return;
		}

		if (clientData.count >= maxRequests) {
			const retryAfter = Math.ceil((clientData.resetTime - now) / 1000);
			c.header("Retry-After", retryAfter.toString());
			return c.json(
				{
					success: false,
					error: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
				},
				429,
			);
		}

		clientData.count++;
		c.header("X-RateLimit-Limit", maxRequests.toString());
		c.header("X-RateLimit-Remaining", (maxRequests - clientData.count).toString());
		c.header("X-RateLimit-Reset", clientData.resetTime.toString());
		await next();
	};
}
