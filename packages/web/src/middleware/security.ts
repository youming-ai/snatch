import { validate } from "@snatch/shared";
import { getConfig } from "@/config/env";
import type { SupportedPlatform } from "@/types/download";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60_000;

const requestCounts = new Map<string, { count: number; resetTime: number }>();

function hashString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16);
}

export function checkRateLimit(clientId: string): { allowed: boolean; resetTime?: number } {
	const config = getConfig();
	const max = config.rateLimitMax || RATE_LIMIT_MAX;
	const window = config.rateLimitWindow || RATE_LIMIT_WINDOW;
	const now = Date.now();
	const clientData = requestCounts.get(clientId);

	if (!clientData || now > clientData.resetTime) {
		requestCounts.set(clientId, { count: 1, resetTime: now + window });
		return { allowed: true };
	}

	if (clientData.count >= max) {
		return { allowed: false, resetTime: clientData.resetTime };
	}

	clientData.count++;
	return { allowed: true };
}

export function getClientId(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	const realIp = request.headers.get("x-real-ip");
	const ip = realIp || (forwarded ? forwarded.split(",")[0].trim() : "unknown");
	return hashString(ip);
}

export function validateDownloadRequest(
	url: string,
	userAgent?: string,
): { valid: boolean; error?: string; platform?: SupportedPlatform } {
	const validation = validate(url);
	if (!validation.isValid) {
		return { valid: false, error: validation.errors.join(", ") };
	}

	if (userAgent) {
		const suspicious = [/bot/i, /crawler/i, /spider/i, /scraper/i];
		if (suspicious.some((p) => p.test(userAgent)) && import.meta.env.DEV) {
			console.warn("Suspicious user agent:", userAgent);
		}
	}

	return { valid: true, platform: validation.platform };
}

// Periodic cleanup
if (typeof setInterval !== "undefined") {
	setInterval(
		() => {
			const now = Date.now();
			for (const [id, data] of requestCounts.entries()) {
				if (now > data.resetTime) requestCounts.delete(id);
			}
		},
		5 * 60 * 1000,
	);
}
