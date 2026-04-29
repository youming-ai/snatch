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
			throw new Error(`yt-dlp error: ${stderr.trim()}`);
		}

		const stdout = await new Response(proc.stdout).text();
		const json = JSON.parse(stdout);

		return parseYtDlpOutput(json, url);
	} finally {
		clearTimeout(timeout);
	}
}

/**
 * Download video using yt-dlp and stream to response
 */
export function downloadVideoStream(url: string): ReadableStream<Uint8Array> {
	const proc = Bun.spawn(
		["yt-dlp", "-o", "-", "--no-warnings", "--no-playlist", "-f", "best[ext=mp4]/best", url],
		{
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	return new ReadableStream({
		async pull(controller) {
			const reader = proc.stdout.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						controller.close();
						break;
					}
					controller.enqueue(value);
				}
			} catch (error) {
				controller.error(error);
			}
		},
		cancel() {
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
 * Extract formats from yt-dlp JSON
 */
// biome-ignore lint/suspicious/noExplicitAny: yt-dlp JSON output is dynamic
function extractFormats(json: any): VideoFormat[] {
	const formats: VideoFormat[] = [];

	// Try direct URL first
	if (json.url) {
		formats.push({
			quality: "best",
			url: json.url,
			ext: json.ext || "mp4",
			filesize: json.filesize || undefined,
		});
		return formats;
	}

	// Parse formats array
	if (json.formats?.length) {
		const videoFormats = json.formats
			// biome-ignore lint/suspicious/noExplicitAny: yt-dlp JSON is dynamic
			.filter((f: any) => f.vcodec !== "none" && f.url)
			// biome-ignore lint/suspicious/noExplicitAny: yt-dlp JSON is dynamic
			.sort((a: any, b: any) => (b.height || 0) - (a.height || 0))
			.slice(0, 3);

		for (const f of videoFormats) {
			const height = f.height || 0;
			formats.push({
				quality: height > 0 ? `${height}p` : f.format_note || "unknown",
				url: f.url,
				ext: f.ext || "mp4",
				filesize: f.filesize || undefined,
			});
		}
	}

	// Fallback: requested_downloads
	if (formats.length === 0 && json.requested_downloads?.length) {
		for (const d of json.requested_downloads) {
			if (d.url) {
				formats.push({
					quality: "best",
					url: d.url,
					ext: d.ext || "mp4",
					filesize: d.filesize || undefined,
				});
			}
		}
	}

	return formats;
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

	if (host.includes("instagram.com")) return "instagram";
	if (host.includes("tiktok.com")) return "tiktok";
	if (host.includes("x.com") || host.includes("twitter.com")) return "twitter";
	return "unknown";
}
