import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { type ResolveResponse, validateUrl } from "@snatch/shared";
import { type Context, Hono } from "hono";
import { stream } from "hono/streaming";
import { sanitizeFilename, signUrl, verifyUrl } from "../lib/security";
import {
	buildChoices,
	ensureYtDlp,
	executeDownload,
	parseVideoInfo,
	probe,
	type VideoInfo,
} from "../lib/ytdlp";
import { mediaOptionsSchema, resolveInputSchema } from "../schemas/media";

const downloadRouter = new Hono();

interface DownloadParams {
	url: string;
	choiceId: string;
	infoJson: string;
	audioFormat?: string;
	videoQuality?: string;
	downloadMode?: string;
}

/** Canonical, signature-covered payload shared by the resolve and download routes. */
function downloadPayload(p: DownloadParams): string {
	return JSON.stringify([
		p.url,
		p.choiceId,
		p.infoJson,
		p.audioFormat ?? "",
		p.videoQuality ?? "",
		p.downloadMode ?? "",
	]);
}

function generateDownloadUrl(
	params: DownloadParams,
	filename: string,
	origin: string,
	c: Context,
): string {
	const sig = signUrl(downloadPayload(params), c);
	const query = new URLSearchParams({
		url: params.url,
		choiceId: params.choiceId,
		infoJson: params.infoJson,
		filename,
		audioFormat: params.audioFormat ?? "",
		videoQuality: params.videoQuality ?? "",
		downloadMode: params.downloadMode ?? "",
		sig,
	});
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

	const { url, ...options } = parsed.data;

	try {
		const ytdlp = await ensureYtDlp(c.req.raw.signal);
		const { info, infoJsonPath } = await probe(ytdlp, url, c.req.raw.signal);
		const choices = buildChoices(info, options);
		const origin = new URL(c.req.url).origin;
		const titleBase = (info.title || "media").slice(0, 50);

		const picker = choices.map((choice) => ({
			id: choice.id,
			type: choice.kind,
			quality: choice.quality,
			ext: choice.ext,
			label: choice.label,
			url: generateDownloadUrl(
				{
					url,
					choiceId: choice.id,
					infoJson: infoJsonPath,
					audioFormat: options.audioFormat,
					videoQuality: options.videoQuality,
					downloadMode: options.downloadMode,
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
 * GET /api/download
 * Execute yt-dlp download for selected format choice and stream file to client.
 */
downloadRouter.get("/api/download", async (c) => {
	const url = c.req.query("url");
	const choiceId = c.req.query("choiceId");
	const infoJsonPath = c.req.query("infoJson");
	const signature = c.req.query("sig");
	const requestedFilename = c.req.query("filename");
	const audioFormat = c.req.query("audioFormat") ?? "";
	const videoQuality = c.req.query("videoQuality") ?? "";
	const downloadMode = c.req.query("downloadMode") ?? "";

	if (!url || !choiceId || !infoJsonPath || !signature) {
		return c.json({ success: false, error: "Missing required download parameters" }, 400);
	}

	const validation = validateUrl(url);
	if (!validation.valid) {
		return c.json({ success: false, error: validation.error }, 400);
	}

	// Signature is mandatory: it covers the info-json filesystem path and the
	// resolution options, so a caller cannot point --load-info-json at an
	// arbitrary file or tamper with the selected format. Signatures are not
	// single-use, so a saved link can be replayed; reuse is bounded by the
	// per-client rate limiter that gates all /api/* routes.
	const payload = downloadPayload({
		url,
		choiceId,
		infoJson: infoJsonPath,
		audioFormat,
		videoQuality,
		downloadMode,
	});
	if (!verifyUrl(payload, signature, c)) {
		return c.json({ success: false, error: "Invalid download signature" }, 403);
	}

	// Signature is verified; still validate the carried values at this boundary.
	const parsedOptions = mediaOptionsSchema.safeParse({ audioFormat, videoQuality, downloadMode });
	if (!parsedOptions.success) {
		return c.json({ success: false, error: "Invalid download options" }, 400);
	}
	const options = parsedOptions.data;

	try {
		const ytdlp = await ensureYtDlp(c.req.raw.signal);

		// The signed URL always carries an info-json path; reuse it, falling
		// back to a fresh probe only if the cached file is gone or unreadable.
		let info: VideoInfo | undefined;
		let infoJsonToUse = infoJsonPath;
		try {
			info = parseVideoInfo(await fs.readFile(infoJsonPath, "utf-8"));
		} catch {
			const probed = await probe(ytdlp, url, c.req.raw.signal);
			info = probed.info;
			infoJsonToUse = probed.infoJsonPath;
		}

		const choices = buildChoices(info, options);
		const selectedChoice = choices.find((ch) => ch.id === choiceId);
		if (!selectedChoice) {
			return c.json({ success: false, error: "Requested format is no longer available" }, 409);
		}

		const { filePath, cleanup } = await executeDownload(
			{
				ytdlp,
				url,
				infoJsonPath: infoJsonToUse,
				args: selectedChoice.args,
			},
			c.req.raw.signal,
		);

		const stat = await fs.stat(filePath);
		const filename = sanitizeFilename(
			requestedFilename || path.basename(filePath) || "download.mp4",
		);

		c.header("Content-Type", contentTypeFor(selectedChoice.kind, selectedChoice.ext));
		c.header("Content-Disposition", `attachment; filename="${filename}"`);
		c.header("Content-Length", String(stat.size));

		const readStream = createReadStream(filePath);
		return stream(c, async (s) => {
			try {
				for await (const chunk of readStream) {
					await s.write(chunk as Uint8Array);
				}
			} finally {
				await cleanup();
			}
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Download execution failed";
		return c.json({ success: false, error: msg }, 500);
	}
});

const AUDIO_CONTENT_TYPES: Record<string, string> = {
	mp3: "audio/mpeg",
	ogg: "audio/ogg",
	opus: "audio/opus",
	wav: "audio/wav",
};

function contentTypeFor(kind: "video" | "audio", ext: string): string {
	if (kind === "audio") return AUDIO_CONTENT_TYPES[ext] ?? "application/octet-stream";
	return "video/mp4";
}

/**
 * GET /api/info
 * Query engine status.
 */
downloadRouter.get("/api/info", (c) => {
	return c.json({
		engine: "yt-dlp",
		status: "ok",
	});
});

export { downloadRouter };
