import * as crypto from "node:crypto";
import type { Context } from "hono";
import { env } from "hono/adapter";

let fallbackSecret: string | null = null;

export function getSecret(c: Context): string {
	const key = env(c).PROXY_SIGNING_KEY as string | undefined;
	if (key) return key;

	if (!fallbackSecret) {
		fallbackSecret = crypto.randomBytes(32).toString("hex");
	}
	return fallbackSecret;
}

export function signUrl(targetUrl: string, c: Context): string {
	const hmac = crypto.createHmac("sha256", getSecret(c));
	hmac.update(targetUrl);
	return hmac.digest("hex");
}

export function verifyUrl(targetUrl: string, signature: string, c: Context): boolean {
	try {
		const expected = signUrl(targetUrl, c);
		const sigBuf = Buffer.from(signature, "hex");
		const expBuf = Buffer.from(expected, "hex");
		if (sigBuf.length !== expBuf.length) {
			return false;
		}
		return crypto.timingSafeEqual(sigBuf, expBuf);
	} catch {
		return false;
	}
}

export function sanitizeFilename(name: string): string {
	return name.replace(/["\r\n]/g, "").slice(0, 200) || "file";
}
