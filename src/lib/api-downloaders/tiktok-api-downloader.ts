import type { DownloadResult } from "@/types/download";

// Dynamic import for TikTok API
let TiktokModule: any = null;

async function getTiktokModule() {
	if (!TiktokModule) {
		TiktokModule = await import("@tobyg74/tiktok-api-dl");
	}
	return TiktokModule.default || TiktokModule;
}

export interface TikTokDownloaderOptions {
	version?: "v1" | "v2" | "v3";
	proxy?: string;
}

/**
 * TikTok Downloader using @tobyg74/tiktok-api-dl
 * This library uses TikTok's unofficial API endpoints for reliable video extraction
 */
export class TikTokApiDownloader {
	private options: TikTokDownloaderOptions;

	constructor(options: TikTokDownloaderOptions = {}) {
		this.options = {
			version: "v1",
			...options,
		};
	}

	/**
	 * Extract content ID from TikTok URL
	 */
	extractContentId(url: string): string | null {
		try {
			const patterns = [
				/tiktok\.com\/@[^/]+\/video\/(\d+)/i,
				/tiktok\.com\/video\/(\d+)/i,
				/vt\.tiktok\.com\/([A-Za-z0-9_-]+)/i,
				/tiktok\.com\/t\/([A-Za-z0-9_-]+)/i,
				/m\.tiktok\.com\/v\/(\d+)/i,
			];

			for (const pattern of patterns) {
				const match = url.match(pattern);
				if (match) return match[1];
			}

			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Download TikTok video/images from URL
	 */
	async download(url: string): Promise<DownloadResult[]> {
		console.log(`[TikTok API] Starting download for: ${url}`);

		try {
			const Tiktok = await getTiktokModule();

			// Try v1 first (most reliable), then fallback to v2, v3
			const versions: Array<"v1" | "v2" | "v3"> = ["v1", "v2", "v3"];
			let lastError: Error | null = null;

			for (const version of versions) {
				try {
					console.log(`[TikTok API] Trying version ${version}...`);

					const response = await Tiktok.Downloader(url, {
						version,
						proxy: this.options.proxy,
					});

					if (response.status === "success" && response.result) {
						console.log(
							`[TikTok API] Version ${version} succeeded:`,
							response.result.type,
						);
						return this.parseResponse(response, url);
					}

					console.log(
						`[TikTok API] Version ${version} failed:`,
						response.message,
					);
				} catch (err) {
					lastError = err as Error;
					console.log(
						`[TikTok API] Version ${version} error:`,
						(err as Error).message,
					);
				}
			}

			throw lastError || new Error("All TikTok API versions failed");
		} catch (error) {
			console.error("[TikTok API] Download failed:", error);
			throw error;
		}
	}

	/**
	 * Parse TikTok API response to DownloadResult[]
	 */
	private parseResponse(response: any, originalUrl: string): DownloadResult[] {
		const results: DownloadResult[] = [];
		const result = response.result;

		if (!result) return results;

		const baseResult = {
			platform: "tiktok" as const,
			url: originalUrl,
		};

		// Handle video type
		if (result.type === "video" && result.video) {
			const videoUrl =
				result.video.playAddr?.[0] ||
				result.video.downloadAddr?.[0] ||
				result.video?.playAddr ||
				result.video?.downloadAddr;

			if (videoUrl) {
				results.push({
					...baseResult,
					id: result.id || this.generateId(),
					type: "video",
					title: result.desc || "TikTok Video",
					thumbnail:
						result.cover?.[0] ||
						result.video?.cover?.[0] ||
						result.originCover?.[0] ||
						"",
					downloadUrl: videoUrl,
					size: "Unknown",
					quality: "hd",
					metadata: {
						author: result.author?.nickname || result.author?.username,
						description: result.desc,
						playCount: result.statistics?.playCount,
						likeCount: result.statistics?.likeCount,
						commentCount: result.statistics?.commentCount,
						shareCount: result.statistics?.shareCount,
					},
				});
			}
		}

		// Handle image/slide type
		if (result.type === "image" && result.images) {
			result.images.forEach((imageUrl: string, index: number) => {
				results.push({
					...baseResult,
					id: `${result.id || this.generateId()}_${index}`,
					type: "image",
					title: `${result.desc || "TikTok Image"} (${index + 1})`,
					thumbnail: imageUrl,
					downloadUrl: imageUrl,
					size: "Unknown",
					metadata: {
						author: result.author?.nickname || result.author?.username,
						description: result.desc,
					},
				});
			});
		}

		// Handle v2/v3 response format
		if (result.video?.playAddr && typeof result.video.playAddr === "string") {
			results.push({
				...baseResult,
				id: this.generateId(),
				type: "video",
				title: result.desc || "TikTok Video",
				thumbnail: result.author?.avatar || "",
				downloadUrl: result.video.playAddr,
				size: "Unknown",
				quality: "hd",
				metadata: {
					author: result.author?.nickname,
				},
			});
		}

		// Handle music download URL if available
		if (result.music?.playUrl) {
			const musicUrl = Array.isArray(result.music.playUrl)
				? result.music.playUrl[0]
				: result.music.playUrl;

			if (musicUrl) {
				results.push({
					...baseResult,
					id: `${result.id || this.generateId()}_music`,
					type: "video", // Audio treated as video for download purposes
					title: `🎵 ${result.music.title || "TikTok Audio"}`,
					thumbnail: result.music.coverLarge?.[0] || "",
					downloadUrl: musicUrl,
					size: "Unknown",
					quality: "audio" as any,
					metadata: {
						author: result.music.author,
						duration: result.music.duration,
					},
				});
			}
		}

		return results;
	}

	private generateId(): string {
		return Math.random().toString(36).substring(2, 15);
	}
}

// Export singleton instance
export const tiktokApiDownloader = new TikTokApiDownloader();
