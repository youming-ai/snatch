import { validateUrl } from "@snatch/shared";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { type CobaltResolved, resolveViaCobalt } from "../lib/cobalt";

const downloadRouter = new Hono();

// Strip characters that would break the Content-Disposition header.
function sanitizeFilename(name: string): string {
	return name.replace(/["\r\n]/g, "").slice(0, 200) || "video.mp4";
}

downloadRouter.get("/api/download", async (c) => {
	const url = c.req.query("url");

	if (!url) {
		return c.json({ success: false, error: "URL is required" }, 400);
	}

	const validation = validateUrl(url);
	if (!validation.valid) {
		return c.json({ success: false, error: validation.error }, 400);
	}

	// Resolve the best-quality downloadable URL via the self-hosted cobalt instance.
	let resolved: CobaltResolved;
	try {
		resolved = await resolveViaCobalt(url, "max");
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Download failed";
		return c.json({ success: false, error: msg }, 502);
	}

	// Proxy the file through our origin so the browser never talks to cobalt.
	let upstream: Response;
	try {
		upstream = await fetch(resolved.url, { signal: c.req.raw.signal });
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Download failed";
		return c.json({ success: false, error: msg }, 502);
	}

	if (!upstream.ok || !upstream.body) {
		return c.json({ success: false, error: `Upstream returned ${upstream.status}` }, 502);
	}

	c.header("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
	c.header("Content-Disposition", `attachment; filename="${sanitizeFilename(resolved.filename)}"`);
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

export { downloadRouter };
