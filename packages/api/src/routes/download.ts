import { createReadStream, type Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { type ResolveResponse, validateUrl } from "@snatch/shared";
import { type Context, Hono } from "hono";
import { stream } from "hono/streaming";
import type { PinoLogger } from "hono-pino";
import { parseRange } from "../lib/range";
import { sanitizeFilename, signUrl, verifyUrl } from "../lib/security";
import {
	buildChoices,
	type DownloadEvent,
	downloadWithProgress,
	ensureYtDlp,
	hasFfmpeg,
	parseVideoInfo,
	probe,
	type VideoInfo,
} from "../lib/ytdlp";
import { resolveInputSchema } from "../schemas/media";

// Carries the logger slot that app.ts's pinoLogger middleware fills, so a
// handler can record why it failed instead of only telling the client.
const downloadRouter = new Hono<{ Variables: { logger: PinoLogger } }>();

interface ProgressParams {
	url: string;
	choiceId: string;
	infoJson: string;
}

interface FileParams {
	file: string;
}

/** Canonical, signature-covered payload for the progress endpoint. */
function progressPayload(p: ProgressParams): string {
	return JSON.stringify([p.url, p.choiceId, p.infoJson]);
}

/** Canonical, signature-covered payload for the file-delivery endpoint. */
function filePayload(p: FileParams): string {
	return JSON.stringify([p.file]);
}

function generateProgressUrl(
	params: ProgressParams,
	filename: string,
	origin: string,
	c: Context,
): string {
	const sig = signUrl(progressPayload(params), c);
	const query = new URLSearchParams({
		url: params.url,
		choiceId: params.choiceId,
		infoJson: params.infoJson,
		filename,
		sig,
	});
	return `${origin}/api/download/progress?${query.toString()}`;
}

function generateFileUrl(filePath: string, origin: string, c: Context): string {
	const sig = signUrl(filePayload({ file: filePath }), c);
	const query = new URLSearchParams({ file: filePath, sig });
	return `${origin}/api/download?${query.toString()}`;
}

/**
 * POST /api/resolve
 * Resolve media URL formats using yt-dlp.
 */
downloadRouter.post("/api/resolve", async (c) => {
	let raw: unknown;
	try {
		raw = await c.req.json();
	} catch {
		return c.json({ success: false, error: "Invalid JSON in request body" }, 400);
	}

	const parsed = resolveInputSchema.safeParse(raw);
	if (!parsed.success) {
		return c.json(
			{ success: false, error: parsed.error.issues[0]?.message ?? "Invalid request" },
			400,
		);
	}

	const { url } = parsed.data;

	try {
		const ytdlp = await ensureYtDlp();
		const { info, infoJsonPath } = await probe(ytdlp, url, c.req.raw.signal);
		const choices = buildChoices(info);
		const origin = new URL(c.req.url).origin;
		const titleBase = (info.title || "media").slice(0, 50);

		const picker = choices.map((choice) => ({
			id: choice.id,
			type: choice.kind,
			quality: choice.quality,
			ext: choice.ext,
			label: choice.label,
			url: generateProgressUrl(
				{
					url,
					choiceId: choice.id,
					infoJson: infoJsonPath,
				},
				`${titleBase}.${choice.ext}`,
				origin,
				c,
			),
			thumb: info.thumbnail,
		}));

		const response: ResolveResponse = {
			status: "picker",
			title: info.title,
			thumbnail: info.thumbnail,
			duration: info.duration,
			filename: `${titleBase}.mp4`,
			picker,
		};

		return c.json(response);
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Resolution failed";
		// The client already sees this message; the log is what lets an operator
		// tell "the site blocks us" apart from "our engine is broken".
		c.var.logger?.warn({ err: error, url }, "resolve failed");
		return c.json(
			{
				status: "error",
				error: { code: "api.resolve_failed", message: msg },
			},
			200,
		);
	}
});

/**
 * GET /api/download/progress
 * Server-sent events endpoint that runs yt-dlp for the selected format and
 * streams live progress. Once the file is ready, it emits a `ready` event
 * carrying a signed URL to the byte-delivery route. This mirrors yoinks'
 * probing → picking → downloading → done flow in the browser.
 */
downloadRouter.get("/api/download/progress", async (c) => {
	const url = c.req.query("url");
	const choiceId = c.req.query("choiceId");
	const infoJsonPath = c.req.query("infoJson");
	const signature = c.req.query("sig");
	const requestedFilename = c.req.query("filename");

	if (!url || !choiceId || !infoJsonPath || !signature) {
		return c.json({ success: false, error: "Missing required download parameters" }, 400);
	}

	const validation = validateUrl(url);
	if (!validation.valid) {
		return c.json({ success: false, error: validation.error }, 400);
	}

	if (!verifyUrl(progressPayload({ url, choiceId, infoJson: infoJsonPath }), signature, c)) {
		return c.json({ success: false, error: "Invalid download signature" }, 403);
	}

	c.header("Content-Type", "text/event-stream");
	c.header("Cache-Control", "no-cache");
	c.header("Connection", "keep-alive");

	return stream(c, async (s) => {
		const send = (event: string, data: Record<string, unknown>) => {
			void s.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
		};

		try {
			const ytdlp = await ensureYtDlp();

			let info: VideoInfo | undefined;
			let infoJsonToUse = infoJsonPath;
			try {
				info = parseVideoInfo(await fs.readFile(infoJsonPath, "utf-8"));
			} catch (error) {
				// The signed probe metadata is gone — swept, restarted, or written by
				// another replica. Re-probing is correct but repeats a full extraction,
				// so keep a trace of why it was necessary.
				c.var.logger?.warn({ err: error, url }, "probe metadata unavailable; re-probing");
				const probed = await probe(ytdlp, url, c.req.raw.signal);
				info = probed.info;
				infoJsonToUse = probed.infoJsonPath;
			}

			const choices = buildChoices(info);
			const selectedChoice = choices.find((ch) => ch.id === choiceId);
			if (!selectedChoice) {
				c.var.logger?.warn({ choiceId, url }, "requested format is no longer available");
				send("failed", { message: "Requested format is no longer available" });
				return;
			}

			const events = downloadWithProgress(
				{
					ytdlp,
					url,
					infoJsonPath: infoJsonToUse,
					args: selectedChoice.args,
				},
				c.req.raw.signal,
			);

			let result = await events.next();
			while (!result.done) {
				const event = result.value as DownloadEvent;
				if (event.kind === "progress") {
					send("progress", {
						downloadedBytes: event.downloadedBytes,
						totalBytes: event.totalBytes,
						speed: event.speed,
						eta: event.eta,
						part: event.part,
						totalParts: event.totalParts,
					});
				} else if (event.kind === "processing") {
					send("processing", {});
				}
				result = await events.next();
			}

			if (!result.value) {
				c.var.logger?.warn({ url }, "download finished without a file path");
				send("failed", { message: "Download completed without producing a file path." });
				return;
			}

			const { filePath } = result.value;
			const origin = new URL(c.req.url).origin;
			const filename = sanitizeFilename(
				requestedFilename || path.basename(filePath) || "download.mp4",
			);
			send("ready", {
				downloadUrl: generateFileUrl(filePath, origin, c),
				filename,
				contentType: contentTypeFor(selectedChoice.kind),
			});

			// The file is deleted only after the browser has fetched and the
			// byte-delivery route has finished streaming it (see /api/download).
			// Delete the transient probe metadata now so it doesn't leak if the
			// download is never followed.
			void fs.rm(infoJsonToUse, { force: true }).catch(() => {});
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Download failed";
			// A caller that closed the tab aborts the child deliberately; that is a
			// normal outcome, not an error worth paging anyone over.
			if (c.req.raw.signal.aborted) {
				c.var.logger?.info({ url }, "download cancelled by client");
			} else {
				c.var.logger?.error({ err: error, url }, "download failed");
			}
			send("failed", { message: msg });
		}
	});
});

/**
 * GET /api/download
 * Deliver an already-prepared file. The `file` parameter is signed by the
 * progress endpoint so arbitrary filesystem paths cannot be requested.
 */
downloadRouter.get("/api/download", async (c) => {
	const filePath = c.req.query("file");
	const signature = c.req.query("sig");

	if (!filePath || !signature) {
		return c.json({ success: false, error: "Missing required download parameters" }, 400);
	}

	if (!verifyUrl(filePayload({ file: filePath }), signature, c)) {
		return c.json({ success: false, error: "Invalid download signature" }, 403);
	}

	// Only the stat can fail for a legitimate reason (the file was swept or the
	// process restarted), so it owns the 404; everything below it is response
	// construction, which must not be answered with a JSON body under a media
	// status.
	let stat: Stats;
	try {
		stat = await fs.stat(filePath);
	} catch (error) {
		const msg = error instanceof Error ? error.message : "File not found";
		c.var.logger?.warn({ err: error, file: filePath }, "prepared file unavailable");
		return c.json({ success: false, error: msg }, 404);
	}

	const filename = sanitizeFilename(path.basename(filePath) || "download.mp4");
	const range = parseRange(c.req.header("range"), stat.size);

	if (range === "unsatisfiable") {
		c.header("Content-Range", `bytes */${stat.size}`);
		return c.json({ success: false, error: "Requested range not satisfiable" }, 416);
	}

	const start = range?.start ?? 0;
	const end = range?.end ?? stat.size - 1;
	const length = Math.max(0, end - start + 1);
	// Only a response that carried the file from byte 0 to EOF proves the client
	// has it. A suffix or resumed range also finishes at EOF while leaving the
	// earlier bytes undelivered, so EOF alone is not enough: deleting there would
	// 404 the very retry that range was resuming.
	const deliveredWholeFile = start === 0 && end === stat.size - 1;

	c.header("Accept-Ranges", "bytes");
	c.header("Content-Type", contentTypeFor(path.extname(filePath) === ".mp3" ? "audio" : "video"));
	c.header("Content-Disposition", contentDisposition(filename));
	c.header("Content-Length", String(length));
	// Per-user media behind a one-shot signed URL: nothing in between should
	// hold a copy.
	c.header("Cache-Control", "no-store");
	if (range) {
		c.status(206);
		c.header("Content-Range", `bytes ${start}-${end}/${stat.size}`);
	}

	// No explicit bounds for an ordinary request: on an empty file the computed
	// range would be `end: -1`, which the stream rejects outright.
	const readStream = range
		? createReadStream(filePath, { start, end })
		: createReadStream(filePath);
	return stream(c, async (s) => {
		try {
			for await (const chunk of readStream) {
				// Once the client is gone, keep reading the file for nobody.
				if (s.aborted) break;
				await s.write(chunk as Uint8Array);
			}
		} finally {
			readStream.destroy();
			// Reclaim the file only after a complete delivery to a client that is
			// still there. `readableEnded` rules out a transfer that died
			// mid-stream, which has to stay on disk for the retry it invites;
			// anything genuinely abandoned is left to the temp sweeper.
			if (deliveredWholeFile && !s.aborted && readStream.readableEnded) {
				await removePreparedFile(filePath);
			}
		}
	});
});

/** Drop the served media plus the partial artifacts yt-dlp may have left. */
function removePreparedFile(filePath: string): Promise<unknown> {
	return Promise.allSettled(
		[filePath, `${filePath}.part`, `${filePath}.ytdl`].map((file) => fs.rm(file, { force: true })),
	);
}

/**
 * RFC 6266 Content-Disposition: an ASCII fallback for old clients plus the real
 * UTF-8 name, which would otherwise mojibake a non-Latin title.
 */
function contentDisposition(filename: string): string {
	const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** The engine produces mp4 for video and mp3 for audio, and nothing else. */
function contentTypeFor(kind: "video" | "audio"): string {
	return kind === "audio" ? "audio/mpeg" : "video/mp4";
}

/**
 * GET /api/info
 * Query engine status.
 */
downloadRouter.get("/api/info", async (c) => {
	return c.json({
		engine: "yt-dlp",
		status: "ok",
		// Most sites publish video and audio separately, so a host without ffmpeg
		// cannot finish the merge. Surfacing it here makes that diagnosable
		// without digging through failed downloads.
		ffmpeg: await hasFfmpeg(),
	});
});

export { downloadRouter };
