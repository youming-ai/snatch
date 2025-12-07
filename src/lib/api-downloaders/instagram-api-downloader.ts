import type { DownloadResult } from "@/types/download";

// Dynamic import for instagram-url-direct
let instagramGetUrl: any = null;

async function getInstagramDownloader() {
	if (!instagramGetUrl) {
		const module = await import("instagram-url-direct");
		instagramGetUrl = module.instagramGetUrl;
	}
	return instagramGetUrl;
}

export interface InstagramDownloaderOptions {
	proxy?: string;
}

/**
 * Instagram Downloader using instagram-url-direct
 * Gets direct download URLs from Instagram posts without requiring login
 */
export class InstagramApiDownloader {
	private _options: InstagramDownloaderOptions;

	constructor(options: InstagramDownloaderOptions = {}) {
		this._options = options;
	}

	/**
	 * Get current options
	 */
	get options(): InstagramDownloaderOptions {
		return this._options;
	}

	/**
	 * Extract content ID from Instagram URL
	 */
	extractContentId(url: string): string | null {
		try {
			const patterns = [
				/instagram\.com\/reel\/([A-Za-z0-9_-]+)/i,
				/instagram\.com\/p\/([A-Za-z0-9_-]+)/i,
				/instagram\.com\/tv\/([A-Za-z0-9_-]+)/i,
				/instagram\.com\/stories\/[^/]+\/(\d+)/i,
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
	 * Download media from Instagram URL
	 */
	async download(url: string): Promise<DownloadResult[]> {
		console.log(`[Instagram API] Starting download for: ${url}`);

		try {
			const getUrl = await getInstagramDownloader();

			// Clean the URL (remove query params that might cause issues)
			const cleanUrl = this.cleanUrl(url);
			console.log(`[Instagram API] Fetching media info for: ${cleanUrl}`);

			const response = await getUrl(cleanUrl, { retries: 3, delay: 1000 });

			if (!response) {
				throw new Error("No response from Instagram API");
			}

			console.log(`[Instagram API] Response received:`, {
				hasMedias: !!response.url_list,
				mediaCount: response.url_list?.length || 0,
			});

			return this.parseResponse(response, url);
		} catch (error) {
			console.error("[Instagram API] Download failed:", error);
			throw error;
		}
	}

	/**
	 * Clean Instagram URL for API request
	 */
	private cleanUrl(url: string): string {
		try {
			const urlObj = new URL(url);
			// Keep only the path, remove query params
			return `${urlObj.origin}${urlObj.pathname}`;
		} catch {
			return url;
		}
	}

	/**
	 * Parse instagram-url-direct response to DownloadResult[]
	 */
	private parseResponse(response: any, originalUrl: string): DownloadResult[] {
		const results: DownloadResult[] = [];
		const contentId = this.extractContentId(originalUrl) || `instagram_${Date.now()}`;

		// Handle url_list (array of media URLs)
		if (response.url_list && Array.isArray(response.url_list)) {
			response.url_list.forEach((mediaUrl: string, index: number) => {
				const isVideo = this.isVideoUrl(mediaUrl);
				
				results.push({
					platform: "instagram" as const,
					url: originalUrl,
					id: `${contentId}_${index}`,
					type: isVideo ? "video" : "image",
					title: response.post_info?.caption || `Instagram ${isVideo ? "Video" : "Image"} ${index + 1}`,
					thumbnail: response.thumbnail || mediaUrl,
					downloadUrl: mediaUrl,
					size: "Unknown",
					quality: "hd",
					metadata: {
						author: response.post_info?.username,
						description: response.post_info?.caption,
						likeCount: response.post_info?.like_count,
						commentCount: response.post_info?.comment_count,
					},
				});
			});
		}

		// If no media found in url_list, check for single media
		if (results.length === 0 && response.media) {
			const isVideo = response.media.includes(".mp4") || response.media.includes("video");
			
			results.push({
				platform: "instagram" as const,
				url: originalUrl,
				id: contentId,
				type: isVideo ? "video" : "image",
				title: response.post_info?.caption || "Instagram Content",
				thumbnail: response.thumbnail || "",
				downloadUrl: response.media,
				size: "Unknown",
				quality: "hd",
				metadata: {
					author: response.post_info?.username,
				},
			});
		}

		if (results.length === 0) {
			throw new Error("No media found in Instagram response");
		}

		console.log(`[Instagram API] Successfully parsed ${results.length} media items`);
		return results;
	}

	/**
	 * Check if URL is a video based on extension or path
	 */
	private isVideoUrl(url: string): boolean {
		const videoIndicators = [".mp4", ".mov", ".webm", "/video/", "video_url"];
		return videoIndicators.some((indicator) =>
			url.toLowerCase().includes(indicator),
		);
	}
}

// Export singleton instance
export const instagramApiDownloader = new InstagramApiDownloader();
