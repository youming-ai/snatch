import { validateUrl } from "@snatch/shared";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { downloadVideoStream } from "../lib/extractor";

const downloadRouter = new Hono();

downloadRouter.get("/api/download", async (c) => {
	const url = c.req.query("url");
	const formatId = c.req.query("format_id");

	if (!url) {
		return c.json({ success: false, error: "URL is required" }, 400);
	}

	const validation = validateUrl(url);
	if (!validation.valid) {
		return c.json({ success: false, error: validation.error }, 400);
	}

	try {
		const videoStream = downloadVideoStream(url, formatId || undefined);

		// Use application/octet-stream for downloads since actual format may vary
		c.header("Content-Type", "application/octet-stream");
		c.header("Content-Disposition", 'attachment; filename="video.mp4"');

		return stream(c, async (stream) => {
			const reader = videoStream.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					await stream.write(value);
				}
			} finally {
				reader.releaseLock();
			}
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Download failed";
		return c.json({ success: false, error: msg }, 500);
	}
});

export { downloadRouter };
