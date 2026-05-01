import type { ExtractResponse, VideoFormat } from "@snatch/shared";

/**
 * Extract video information using yt-dlp with retry logic
 */
export async function extractVideoInfo(url: string): Promise<ExtractResponse> {
	const proc = Bun.spawn(["yt-dlp", "--dump-json", "--no-warnings", "--no-playlist", url], {
		stdout: "pipe",
		stderr: "pipe",
	});

	const timeout = setTimeout(() => {
		proc.kill();
	}, 30_000);

	try {
		const exitCode = await proc.exited;
		clearTimeout(timeout);

		if (exitCode !== 0) {
			const stderr = await new Response(proc.stderr).text();
			const firstLine = stderr.trim().split("\n")[0] || "yt-dlp failed";
			throw new Error(`Extraction failed: ${firstLine}`);
		}

		const stdout = await new Response(proc.stdout).text();
		const json = JSON.parse(stdout);

		return parseYtDlpOutput(json, url);
	} finally {
		clearTimeout(timeout);
	}
}

/**
 * Download video using yt-dlp and stream to response.
 * Includes a 60s read timeout to kill stuck processes.
 */
export function downloadVideoStream(url: string, formatId?: string): ReadableStream<Uint8Array> {
	const formatArg = formatId || "best[ext=mp4]/best";
	const proc = Bun.spawn(
		["yt-dlp", "-o", "-", "--no-warnings", "--no-playlist", "-f", formatArg, url],
		{
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	const READ_TIMEOUT_MS = 60_000;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const resetTimeout = () => {
		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			proc.kill();
		}, READ_TIMEOUT_MS);
	};

	return new ReadableStream({
		start() {
			resetTimeout();
		},
		async pull(controller) {
			const reader = proc.stdout.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						if (timeoutId) clearTimeout(timeoutId);
						controller.close();
						break;
					}
					resetTimeout();
					controller.enqueue(value);
				}
			} catch (error) {
				if (timeoutId) clearTimeout(timeoutId);
				controller.error(error);
			} finally {
				reader.releaseLock();
			}
		},
		cancel() {
			if (timeoutId) clearTimeout(timeoutId);
			proc.kill();
		},
	});
}

/**
 * Parse yt-dlp JSON output into ExtractResponse
 */
// biome-ignore lint/suspicious/noExplicitAny: yt-dlp JSON output is dynamic
function parseYtDlpOutput(json: any, url: string): ExtractResponse {
	const platform = detectPlatform(url);
	const title = json.title || "Untitled";
	const thumbnail = json.thumbnail || undefined;
	const formats = extractFormats(json);

	return {
		success: true,
		platform,
		title,
		thumbnail,
		formats,
	};
}

/**
 * Extract formats from yt-dlp JSON.
 *
 * Always prefers the `formats[]` array so the user gets a real quality
 * picker. Top-level `url` is only used as a last resort, because yt-dlp
 * exposes it for every video (it's the auto-selected best format) and
 * short-circuiting on it collapses everything to a single option.
 */
// biome-ignore lint/suspicious/noExplicitAny: yt-dlp JSON output is dynamic
function extractFormats(json: any): VideoFormat[] {
	if (json.formats?.length) {
		// biome-ignore lint/suspicious/noExplicitAny: yt-dlp JSON is dynamic
		const videoFormats = json.formats.filter((f: any) => f.vcodec !== "none" && f.url);

		// Dedupe by height: same-resolution variants (e.g. TikTok DASH segments
		// numbered -0 / -1) are noise to the user. Keep the largest filesize.
		// biome-ignore lint/suspicious/noExplicitAny: yt-dlp JSON is dynamic
		const byHeight = new Map<number, any>();
		for (const f of videoFormats) {
			const h = f.height || 0;
			const existing = byHeight.get(h);
			const size = f.filesize || f.filesize_approx || 0;
			const existingSize = existing ? existing.filesize || existing.filesize_approx || 0 : -1;
			if (!existing || size > existingSize) {
				byHeight.set(h, f);
			}
		}

		const ranked = [...byHeight.values()]
			.sort((a, b) => (b.height || 0) - (a.height || 0))
			.slice(0, 3);

		const formats: VideoFormat[] = ranked.map((f) => {
			const height = f.height || 0;
			return {
				format_id: f.format_id || "unknown",
				quality: height > 0 ? `${height}p` : f.format_note || "unknown",
				url: f.url,
				ext: f.ext || "mp4",
				filesize: f.filesize || f.filesize_approx || undefined,
			};
		});

		if (formats.length > 0) return formats;
	}

	// Fallback: requested_downloads (rare — when yt-dlp resolves a single download)
	if (json.requested_downloads?.length) {
		const formats: VideoFormat[] = json.requested_downloads
			// biome-ignore lint/suspicious/noExplicitAny: yt-dlp JSON is dynamic
			.filter((d: any) => d.url)
			// biome-ignore lint/suspicious/noExplicitAny: yt-dlp JSON is dynamic
			.map((d: any) => ({
				format_id: d.format_id || "best",
				quality: "best",
				url: d.url,
				ext: d.ext || "mp4",
				filesize: d.filesize || d.filesize_approx || undefined,
			}));
		if (formats.length > 0) return formats;
	}

	// Last resort: top-level url (single quality)
	if (json.url) {
		return [
			{
				format_id: json.format_id || "best",
				quality: "best",
				url: json.url,
				ext: json.ext || "mp4",
				filesize: json.filesize || json.filesize_approx || undefined,
			},
		];
	}

	return [];
}

/**
 * Detect platform from URL
 */
function detectPlatform(url: string): string {
	const host = (() => {
		try {
			return new URL(url).hostname.toLowerCase();
		} catch {
			return "";
		}
	})();

	if (host.includes("tiktok.com")) return "tiktok";
	if (host.includes("x.com") || host.includes("twitter.com")) return "twitter";
	if (host.includes("youtube.com") || host === "youtu.be" || host.endsWith(".youtu.be"))
		return "youtube";
	return "unknown";
}
