import type { DownloadResult } from "@/types/download";

// Dynamic import for Twitter Scraper
let ScraperClass: any = null;
let scraperInstance: any = null;

async function getScraper() {
	if (!ScraperClass) {
		const module = await import("@the-convocation/twitter-scraper");
		ScraperClass = module.Scraper;
	}
	if (!scraperInstance) {
		scraperInstance = new ScraperClass();
	}
	return scraperInstance;
}

export interface TwitterDownloaderOptions {
	// Twitter credentials for authenticated access (optional but recommended)
	username?: string;
	password?: string;
	email?: string;
}

/**
 * Twitter/X Downloader using @the-convocation/twitter-scraper
 * This library reverse-engineers Twitter's frontend API for video/image extraction
 */
export class TwitterApiDownloader {
	private options: TwitterDownloaderOptions;
	private isLoggedIn = false;

	constructor(options: TwitterDownloaderOptions = {}) {
		this.options = options;
	}

	/**
	 * Extract tweet ID from Twitter/X URL
	 */
	extractTweetId(url: string): string | null {
		try {
			const patterns = [
				/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/i,
				/\/status\/(\d+)/i,
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
	 * Login to Twitter (optional, but may provide better access)
	 */
	async login(): Promise<boolean> {
		if (
			this.isLoggedIn ||
			!this.options.username ||
			!this.options.password ||
			!this.options.email
		) {
			return this.isLoggedIn;
		}

		try {
			const scraper = await getScraper();
			await scraper.login(
				this.options.username,
				this.options.password,
				this.options.email,
			);
			this.isLoggedIn = true;
			console.log("[Twitter API] Successfully logged in");
			return true;
		} catch (error) {
			console.warn("[Twitter API] Login failed:", error);
			return false;
		}
	}

	/**
	 * Download media from Twitter/X URL
	 */
	async download(url: string): Promise<DownloadResult[]> {
		console.log(`[Twitter API] Starting download for: ${url}`);

		const tweetId = this.extractTweetId(url);
		if (!tweetId) {
			throw new Error("Could not extract tweet ID from URL");
		}

		try {
			const scraper = await getScraper();

			// Try to get tweet data
			console.log(`[Twitter API] Fetching tweet ${tweetId}...`);
			const tweet = await scraper.getTweet(tweetId);

			if (!tweet) {
				throw new Error("Tweet not found or not accessible");
			}

			console.log(`[Twitter API] Tweet found: ${tweet.text?.substring(0, 50)}...`);
			return this.parseTweet(tweet, url);
		} catch (error) {
			console.error("[Twitter API] Download failed:", error);
			throw error;
		}
	}

	/**
	 * Parse tweet data to DownloadResult[]
	 */
	private parseTweet(tweet: any, originalUrl: string): DownloadResult[] {
		const results: DownloadResult[] = [];

		const baseResult = {
			platform: "twitter" as const,
			url: originalUrl,
		};

		// Handle videos
		if (tweet.videos && tweet.videos.length > 0) {
			tweet.videos.forEach((video: any, index: number) => {
				// Get the highest quality video URL
				let videoUrl = video.url;
				let quality: "hd" | "sd" = "hd";

				// Twitter videos often have multiple variants
				if (video.variants && Array.isArray(video.variants)) {
					// Sort by bitrate descending to get highest quality
					const sorted = video.variants
						.filter((v: any) => v.content_type === "video/mp4")
						.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

					if (sorted.length > 0) {
						videoUrl = sorted[0].url;
					}
				}

				if (videoUrl) {
					results.push({
						...baseResult,
						id: `${tweet.id}_video_${index}`,
						type: "video",
						title: tweet.text?.substring(0, 100) || "Twitter Video",
						thumbnail: video.preview || tweet.photos?.[0]?.url || "",
						downloadUrl: videoUrl,
						size: "Unknown",
						quality,
						metadata: {
							author: tweet.username,
							description: tweet.text,
							likeCount: tweet.likes,
							shareCount: tweet.retweets,
							commentCount: tweet.replies,
						},
					});
				}
			});
		}

		// Handle photos/images
		if (tweet.photos && tweet.photos.length > 0) {
			tweet.photos.forEach((photo: any, index: number) => {
				const photoUrl = photo.url || photo;

				if (photoUrl) {
					// Get the highest resolution by appending :orig
					const highResUrl = photoUrl.includes("?")
						? photoUrl.replace(/\?.*/, "?format=jpg&name=orig")
						: `${photoUrl}?format=jpg&name=orig`;

					results.push({
						...baseResult,
						id: `${tweet.id}_photo_${index}`,
						type: "image",
						title: `${tweet.text?.substring(0, 50) || "Twitter Image"} (${index + 1})`,
						thumbnail: photoUrl,
						downloadUrl: highResUrl,
						size: "Unknown",
						metadata: {
							author: tweet.username,
							description: tweet.text,
							likeCount: tweet.likes,
						},
					});
				}
			});
		}

		// Handle GIFs (treated as video)
		if (tweet.gifs && tweet.gifs.length > 0) {
			tweet.gifs.forEach((gif: any, index: number) => {
				const gifUrl = gif.url || gif;

				if (gifUrl) {
					results.push({
						...baseResult,
						id: `${tweet.id}_gif_${index}`,
						type: "video",
						title: `${tweet.text?.substring(0, 50) || "Twitter GIF"} (GIF)`,
						thumbnail: gif.preview || "",
						downloadUrl: gifUrl,
						size: "Unknown",
						quality: "sd",
						metadata: {
							author: tweet.username,
							description: tweet.text,
						},
					});
				}
			});
		}

		// If no media found, check for quoted tweet media
		if (results.length === 0 && tweet.quotedStatus) {
			console.log("[Twitter API] Checking quoted tweet for media...");
			const quotedResults = this.parseTweet(tweet.quotedStatus, originalUrl);
			results.push(...quotedResults);
		}

		if (results.length === 0) {
			console.log("[Twitter API] No media found in tweet");
		}

		return results;
	}
}

// Export singleton instance
export const twitterApiDownloader = new TwitterApiDownloader();
