import {
	type CobaltOptions,
	type CobaltResponse,
	sanitizeCobaltOptions,
	validateUrl,
} from "@snatch/shared";
import { type Context, Hono } from "hono";
import { env } from "hono/adapter";
import { stream } from "hono/streaming";
import { getCobaltInfo, resolveViaCobalt } from "../lib/cobalt";
import { isSafeUrl, sanitizeFilename, signUrl, verifyUrl } from "../lib/security";

const downloadRouter = new Hono();

/**
 * Helper to rewrite raw cobalt URLs to point to our proxy endpoints,
 * keeping the cobalt instance internal-only.
 */
function rewriteCobaltUrls(data: CobaltResponse, origin: string, c: Context): CobaltResponse {
	const result = { ...data };

	if (result.status === "tunnel" || result.status === "redirect") {
		if (result.url) {
			const sig = signUrl(result.url, c);
			result.url = `${origin}/api/proxy?url=${encodeURIComponent(result.url)}&sig=${sig}&filename=${encodeURIComponent(result.filename || "file")}`;
		}
	} else if (result.status === "picker" && result.picker) {
		result.picker = result.picker.map((item) => {
			const sig = signUrl(item.url, c);
			return {
				...item,
				url: `${origin}/api/proxy?url=${encodeURIComponent(item.url)}&sig=${sig}&filename=${encodeURIComponent(result.filename || "file")}`,
			};
		});
	} else if (result.status === "local-processing") {
		// Detect if we are running in the Bun environment.
		// If not (e.g. Cloudflare Workers), gracefully degrade by returning a client error status.
		if (typeof Bun !== "undefined") {
			const tunnelsJson = JSON.stringify(result.tunnels || []);
			const sig = signUrl(tunnelsJson, c);
			result.status = "tunnel";
			result.url = `${origin}/api/local-process?tunnels=${encodeURIComponent(tunnelsJson)}&sig=${sig}&type=${result.type || "merge"}&filename=${encodeURIComponent(result.filename || "file")}`;
		} else {
			result.status = "error";
			result.error = {
				code: "api.local_processing_unsupported",
				context: { service: result.service || "unknown" },
			};
		}
	}

	return result;
}

/**
 * POST /api/resolve
 * Resolve a media link with custom settings and headers, returning a structured JSON response.
 */
downloadRouter.post("/api/resolve", async (c) => {
	let body: ({ url?: string } & CobaltOptions) | null = null;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ success: false, error: "Invalid JSON in request body" }, 400);
	}

	if (!body) {
		return c.json({ success: false, error: "Request body is required" }, 400);
	}

	const { url, ...options } = body;
	if (!url || typeof url !== "string") {
		return c.json({ success: false, error: "URL is required" }, 400);
	}

	const validation = validateUrl(url);
	if (!validation.valid) {
		return c.json({ success: false, error: validation.error }, 400);
	}

	const authHeaders: Record<string, string> = {};
	const authHeader = c.req.header("Authorization");
	if (authHeader) authHeaders.Authorization = authHeader;
	const turnstileHeader = c.req.header("cf-turnstile-response");
	if (turnstileHeader) authHeaders["cf-turnstile-response"] = turnstileHeader;

	try {
		const cobaltUrl = (env(c).COBALT_API_URL as string | undefined) || "http://localhost:9000";
		const cleanOptions = sanitizeCobaltOptions(options);
		const rawResponse = await resolveViaCobalt(
			url,
			cleanOptions as CobaltOptions,
			authHeaders,
			cobaltUrl,
		);

		if (rawResponse.status === "error") {
			return c.json(rawResponse);
		}

		const origin = new URL(c.req.url).origin;
		const rewritten = rewriteCobaltUrls(rawResponse, origin, c);
		return c.json(rewritten);
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Resolution failed";
		return c.json({ success: false, error: msg }, 502);
	}
});

/**
 * GET /api/proxy
 * Tunnel/proxy a resolved media stream through our origin.
 */
downloadRouter.get("/api/proxy", async (c) => {
	const targetUrl = c.req.query("url");
	const signature = c.req.query("sig");
	const filename = c.req.query("filename") || "file";

	if (!targetUrl || !signature) {
		return c.json({ success: false, error: "Missing required parameters" }, 400);
	}

	if (!verifyUrl(targetUrl, signature, c)) {
		return c.json({ success: false, error: "Invalid signature" }, 403);
	}

	const cobaltUrl = (env(c).COBALT_API_URL as string | undefined) || "http://localhost:9000";
	if (!isSafeUrl(targetUrl, cobaltUrl)) {
		return c.json({ success: false, error: "Forbidden target URL" }, 403);
	}

	const authHeaders: Record<string, string> = {};
	const authHeader = c.req.header("Authorization");
	if (authHeader) authHeaders.Authorization = authHeader;

	let upstream: Response;
	try {
		upstream = await fetch(targetUrl, {
			headers: authHeaders,
			signal: c.req.raw.signal,
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Download failed";
		return c.json({ success: false, error: msg }, 502);
	}

	if (!upstream.ok || !upstream.body) {
		return c.json({ success: false, error: `Upstream returned ${upstream.status}` }, 502);
	}

	c.header("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
	c.header("Content-Disposition", `attachment; filename="${sanitizeFilename(filename)}"`);
	const contentLength = upstream.headers.get("content-length");
	if (contentLength) c.header("Content-Length", contentLength);

	const body = upstream.body;
	return stream(c, async (s) => {
		const reader = body.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				await s.write(value);
			}
		} finally {
			reader.releaseLock();
		}
	});
});

/**
 * GET /api/info
 * Query capabilities of the cobalt backend instance.
 */
downloadRouter.get("/api/info", async (c) => {
	try {
		const cobaltUrl = (env(c).COBALT_API_URL as string | undefined) || "http://localhost:9000";
		const info = await getCobaltInfo(cobaltUrl);
		return c.json(info);
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Failed to query cobalt instance";
		return c.json({ success: false, error: msg }, 502);
	}
});

/**
 * GET /api/download (Backwards compatibility endpoint)
 */
downloadRouter.get("/api/download", async (c) => {
	const url = c.req.query("url");
	if (!url) {
		return c.json({ success: false, error: "URL is required" }, 400);
	}

	const validation = validateUrl(url);
	if (!validation.valid) {
		return c.json({ success: false, error: validation.error }, 400);
	}

	try {
		const cobaltUrl = (env(c).COBALT_API_URL as string | undefined) || "http://localhost:9000";
		const rawResponse = await resolveViaCobalt(url, { videoQuality: "max" }, undefined, cobaltUrl);
		if (rawResponse.status === "error") {
			throw new Error(`cobalt error: ${rawResponse.error?.code}`);
		}

		const origin = new URL(c.req.url).origin;
		const rewritten = rewriteCobaltUrls(rawResponse, origin, c);

		if (rewritten.status === "tunnel" && rewritten.url) {
			return c.redirect(rewritten.url);
		}
		if (rewritten.status === "picker" && rewritten.picker?.[0]?.url) {
			return c.redirect(rewritten.picker[0].url);
		}
		throw new Error(`unsupported cobalt status in simple download: ${rewritten.status}`);
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Download failed";
		return c.json({ success: false, error: msg }, 502);
	}
});

export { downloadRouter };
