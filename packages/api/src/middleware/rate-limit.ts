import type { MiddlewareHandler } from "hono";

interface RateLimitOptions {
	maxRequests: number;
	windowMs: number;
}

interface ClientData {
	count: number;
	resetTime: number;
}

const clients = new Map<string, ClientData>();

if (typeof setInterval !== "undefined") {
	setInterval(
		() => {
			const now = Date.now();
			for (const [id, data] of clients.entries()) {
				if (now > data.resetTime) clients.delete(id);
			}
		},
		5 * 60 * 1000,
	);
}

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

function getClientId(c: { req: { header: (name: string) => string | undefined } }): string {
	const trustedIp = c.req.header("cf-connecting-ip") || c.req.header("fly-client-ip");
	if (trustedIp) return simpleHash(`ip:${trustedIp}`);

	const userAgent = c.req.header("user-agent") || "unknown-agent";
	return simpleHash(`fallback:${userAgent}`);
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
	const { maxRequests, windowMs } = options;

	return async (c, next) => {
		const clientId = getClientId(c);
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
