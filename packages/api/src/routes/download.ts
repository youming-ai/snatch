import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type CobaltOptions, type CobaltResponse, validateUrl } from "@snatch/shared";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { getCobaltInfo, resolveViaCobalt } from "../lib/cobalt";

const downloadRouter = new Hono();

// Shared signing key for proxy URLs to prevent SSRF / open-proxy attacks
const FALLBACK_SECRET = crypto.randomBytes(32).toString("hex");

function getSecret(): string {
	return process.env.PROXY_SIGNING_KEY || FALLBACK_SECRET;
}

function signUrl(targetUrl: string): string {
	const hmac = crypto.createHmac("sha256", getSecret());
	hmac.update(targetUrl);
	return hmac.digest("hex");
}

function verifyUrl(targetUrl: string, signature: string): boolean {
	try {
		const expected = signUrl(targetUrl);
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

/**
 * Defense-in-depth: block loopback, link-local, and private IP blocks.
 * Always allows the configured internal cobalt host.
 */
function isSafeUrl(targetUrl: string, cobaltUrl: string): boolean {
	try {
		const parsed = new URL(targetUrl);
		const allowedParsed = new URL(cobaltUrl);
		if (parsed.host === allowedParsed.host) {
			return true;
		}
		const hostname = parsed.hostname.toLowerCase();
		if (
			hostname === "localhost" ||
			hostname === "127.0.0.1" ||
			hostname === "::1" ||
			hostname.startsWith("169.254")
		) {
			return false;
		}
		// Match standard private IPv4 ranges: 10.x, 172.16-31.x, 192.168.x
		const ipv4Pattern = /^(?:10\.|172\.(?:1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;
		if (ipv4Pattern.test(hostname)) {
			return false;
		}
		return true;
	} catch {
		return false;
	}
}

// Strip characters that would break the Content-Disposition header.
function sanitizeFilename(name: string): string {
	return name.replace(/["\r\n]/g, "").slice(0, 200) || "file";
}

/**
 * Helper to rewrite raw cobalt URLs to point to our proxy endpoints,
 * keeping the cobalt instance internal-only.
 */
function rewriteCobaltUrls(data: CobaltResponse, origin: string): CobaltResponse {
	const result = { ...data };

	if (result.status === "tunnel" || result.status === "redirect") {
		if (result.url) {
			const sig = signUrl(result.url);
			result.url = `${origin}/api/proxy?url=${encodeURIComponent(result.url)}&sig=${sig}&filename=${encodeURIComponent(result.filename || "file")}`;
		}
	} else if (result.status === "picker" && result.picker) {
		result.picker = result.picker.map((item) => {
			const sig = signUrl(item.url);
			return {
				...item,
				url: `${origin}/api/proxy?url=${encodeURIComponent(item.url)}&sig=${sig}&filename=${encodeURIComponent(result.filename || "file")}`,
			};
		});
	} else if (result.status === "local-processing") {
		const tunnelsJson = JSON.stringify(result.tunnels || []);
		const sig = signUrl(tunnelsJson);
		result.status = "tunnel";
		result.url = `${origin}/api/local-process?tunnels=${encodeURIComponent(tunnelsJson)}&sig=${sig}&type=${result.type || "merge"}&filename=${encodeURIComponent(result.filename || "file")}`;
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
		const rawResponse = await resolveViaCobalt(url, options, authHeaders);

		if (rawResponse.status === "error") {
			return c.json(rawResponse);
		}

		const origin = new URL(c.req.url).origin;
		const rewritten = rewriteCobaltUrls(rawResponse, origin);
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

	if (!verifyUrl(targetUrl, signature)) {
		return c.json({ success: false, error: "Invalid signature" }, 403);
	}

	const cobaltUrl = process.env.COBALT_API_URL || "http://localhost:9000";
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
 * GET /api/local-process
 * Perform server-side FFmpeg merging/muxing on cobalt segments.
 */
downloadRouter.get("/api/local-process", async (c) => {
	const tunnelsParam = c.req.query("tunnels");
	const signature = c.req.query("sig");
	const type = c.req.query("type") || "merge";
	const filename = c.req.query("filename") || "video.mp4";

	if (!tunnelsParam || !signature) {
		return c.json({ success: false, error: "Missing required parameters" }, 400);
	}

	if (!verifyUrl(tunnelsParam, signature)) {
		return c.json({ success: false, error: "Invalid signature" }, 403);
	}

	let tunnels: string[];
	try {
		tunnels = JSON.parse(tunnelsParam);
	} catch {
		return c.json({ success: false, error: "Invalid tunnels parameter format" }, 400);
	}

	const cobaltUrl = process.env.COBALT_API_URL || "http://localhost:9000";
	for (const url of tunnels) {
		if (!isSafeUrl(url, cobaltUrl)) {
			return c.json({ success: false, error: "Forbidden segment URL" }, 403);
		}
	}

	const tempInputs: string[] = [];
	const outputFilename = `snatch-out-${crypto.randomUUID()}-${filename}`;
	const outputPath = path.join(os.tmpdir(), outputFilename);

	try {
		for (const url of tunnels) {
			const res = await fetch(url, { signal: c.req.raw.signal });
			if (!res.ok) {
				throw new Error(`failed to fetch tunnel segment: HTTP ${res.status}`);
			}
			const tempInputPath = path.join(os.tmpdir(), `snatch-in-${crypto.randomUUID()}`);
			await Bun.write(tempInputPath, res);
			tempInputs.push(tempInputPath);
		}

		let args: string[] = [];
		if (tempInputs.length === 2 && (type === "merge" || type === "remux")) {
			args = [
				"-y",
				"-i",
				tempInputs[0],
				"-i",
				tempInputs[1],
				"-c:v",
				"copy",
				"-c:a",
				"aac",
				"-map",
				"0:v:0",
				"-map",
				"1:a:0",
				outputPath,
			];
		} else if (tempInputs.length === 1 && type === "mute") {
			args = ["-y", "-i", tempInputs[0], "-an", "-c:v", "copy", outputPath];
		} else if (tempInputs.length === 1 && type === "audio") {
			args = ["-y", "-i", tempInputs[0], "-vn", "-c:a", "aac", outputPath];
		} else if (tempInputs.length === 1) {
			args = ["-y", "-i", tempInputs[0], "-c", "copy", outputPath];
		} else {
			throw new Error(`unsupported local processing: type=${type}, parts=${tempInputs.length}`);
		}

		const proc = Bun.spawn(["ffmpeg", ...args]);
		const exitCode = await proc.exited;
		if (exitCode !== 0) {
			const stderr = await new Response(proc.stderr).text().catch(() => "");
			throw new Error(`ffmpeg failed with exit code ${exitCode}: ${stderr}`);
		}

		const outputFile = Bun.file(outputPath);
		const size = outputFile.size;

		c.header("Content-Type", "application/octet-stream");
		c.header("Content-Disposition", `attachment; filename="${sanitizeFilename(filename)}"`);
		c.header("Content-Length", size.toString());

		return stream(c, async (s) => {
			const streamNode = outputFile.stream();
			const reader = streamNode.getReader();
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
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Local processing failed";
		return c.json({ success: false, error: msg }, 502);
	} finally {
		for (const p of tempInputs) {
			fs.promises.unlink(p).catch(() => {});
		}
		fs.promises.unlink(outputPath).catch(() => {});
	}
});

/**
 * GET /api/info
 * Query capabilities of the cobalt backend instance.
 */
downloadRouter.get("/api/info", async (c) => {
	try {
		const info = await getCobaltInfo();
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
		const rawResponse = await resolveViaCobalt(url, { videoQuality: "max" });
		if (rawResponse.status === "error") {
			throw new Error(`cobalt error: ${rawResponse.error?.code}`);
		}

		const origin = new URL(c.req.url).origin;
		const rewritten = rewriteCobaltUrls(rawResponse, origin);

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
