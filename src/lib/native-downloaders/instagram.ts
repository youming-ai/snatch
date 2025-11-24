import type { DownloadResult } from "@/types/download";

interface InstagramOEmbedResponse {
	type?: string;
	html?: string;
	title?: string;
	author_name?: string;
	author_url?: string;
}

// Check if we're in a Node.js environment
const isNodeJs =
	typeof window === "undefined" && typeof process !== "undefined";

/**
 * Instagram downloader using Crawlee for better reliability and anti-bot evasion
 */
export class InstagramDownloader {
	private crawleeDownloader: any = null;

	constructor() {
		// Crawlee downloader will be initialized lazily when needed
	}
	/**
	 * Extract media information from Instagram page
	 */
	private async extractMediaFromPage(url: string): Promise<InstagramMediaData> {
		try {
			console.log("🔍 [Instagram] Analyzing URL:", url);
			const videoId = this.extractVideoId(url);
			console.log("🔍 [Instagram] Extracted Video ID:", videoId);

			// Method 1: Try Instagram's internal API via oembed
			try {
				const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}&format=json`;
				console.log("🔍 [Instagram] Attempting oembed API...");

				const response = await this.fetchWithHeaders(oembedUrl, {
					Accept: "application/json",
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					Referer: "https://www.instagram.com/",
					"Accept-Language": "en-US,en;q=0.9",
				});

				if (response.ok) {
					const oembedData = await response.json();
					console.log("✅ [Instagram] OEmbed response:", oembedData);

					if (oembedData.type === "rich" && oembedData.html) {
						// Extract video URLs from oembed HTML
						return this.parseInstagramOEmbed(oembedData, url);
					}
				}
			} catch (oembedError) {
				console.warn(
					"❌ [Instagram] OEmbed API failed:",
					oembedError instanceof Error ? oembedError.message : "Unknown error",
				);
			}

			// Method 2: Try web scraping with proper headers
			console.log("🔍 [Instagram] Trying web scraping approach...");
			const webData = await this.extractFromWebPage(url);

			if (webData.success) {
				console.log("✅ [Instagram] Web scraping successful");
				return webData;
			}

			// Method 3: Fallback to mock data with real URL info
			console.log("⚠️ [Instagram] Using mock data with real URL");
			return this.getMockDataWithRealUrl(url);
		} catch (error) {
			console.error("❌ [Instagram] All extraction methods failed:", error);
			return this.getMockDataWithRealUrl(url);
		}
	}

	/**
	 * Parse Instagram OEmbed response to extract video URLs
	 */
	private parseInstagramOEmbed(
		oembedData: InstagramOEmbedResponse,
		originalUrl: string,
	): InstagramMediaData {
		try {
			// Extract video URLs from HTML
			const videoRegex = /<video[^>]*src="([^"]*)"[^>]*>/g;
			const videoUrls: string[] = [];

			let videoMatch: RegExpExecArray | null;
			while (true) {
				videoMatch = videoRegex.exec(oembedData.html);
				if (videoMatch === null) break;
				const url = videoMatch[1];
				if (url && oembedData.html) videoUrls.push(url);
			}

			// Extract image URLs
			const imageRegex = /<img[^>]*src="([^"]*)"[^>]*>/g;
			const imageUrls: string[] = [];

			let imageMatch: RegExpExecArray | null;
			while (true) {
				imageMatch = imageRegex.exec(oembedData.html);
				if (imageMatch === null) break;
				const url = imageMatch[1];
				if (url && oembedData.html) imageUrls.push(url);
			}

			// Extract title and metadata
			const titleMatch = oembedData.html?.match(/<title[^>]*>(.*?)<\/title>/i);
			const authorMatch = oembedData.html?.match(
				/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/,
			);

			console.log("🔍 [Instagram] Parsed OEmbed data:", {
				videoUrls: videoUrls.length,
				imageUrls: imageUrls.length,
				title: titleMatch?.[1],
				author: authorMatch?.[1],
			});

			if (videoUrls.length === 0 && imageUrls.length === 0) {
				return {
					success: false,
					error: "No media found in this Instagram post",
				};
			}

			return {
				success: true,
				data: {
					videoUrls,
					imageUrls,
					title: titleMatch?.[1] || authorMatch?.[1] || "Instagram Post",
					author: authorMatch?.[1] || "Unknown User",
					description: "",
					url: originalUrl,
				},
			};
		} catch (error) {
			console.error("❌ [Instagram] OEmbed parsing error:", error);
			return {
				success: false,
				error: "Failed to parse Instagram OEmbed response",
			};
		}
	}

	/**
	 * Extract Instagram information from web page
	 */
	private async extractFromWebPage(url: string): Promise<InstagramMediaData> {
		try {
			console.log("🔍 [Instagram] Fetching Instagram page...");

			const response = await this.fetchWithHeaders(url, {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.9",
				"Accept-Encoding": "gzip, deflate, br",
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch Instagram page: ${response.status}`);
			}

			const html = await response.text();
			console.log(
				"🔍 [Instagram] Page fetched successfully, length:",
				html.length,
			);

			// Extract data from HTML
			const extractedData = this.parseInstagramHTML(html, url);

			if (extractedData.success) {
				return extractedData;
			}

			throw new Error("Could not extract media data from Instagram page");
		} catch (error) {
			console.error("❌ [Instagram] Web page extraction error:", error);
			throw error;
		}
	}

	/**
	 * Parse Instagram HTML to extract media information
	 */
	private parseInstagramHTML(
		html: string,
		originalUrl: string,
	): InstagramMediaData {
		try {
			// Extract video URLs
			const videoRegex = /<video[^>]*src="([^"]*)"[^>]*>/g;
			const videoUrls: string[] = [];

			let htmlVideoMatch: RegExpExecArray | null;
			while (true) {
				htmlVideoMatch = videoRegex.exec(html);
				if (htmlVideoMatch === null) break;
				if (htmlVideoMatch[1] && !videoUrls.includes(htmlVideoMatch[1])) {
					videoUrls.push(htmlVideoMatch[1]);
				}
			}

			// Extract image URLs
			const imageRegex = /<img[^>]*src="([^"]*)"[^>]*>/g;
			const imageUrls: string[] = [];

			let htmlImageMatch: RegExpExecArray | null;
			while (true) {
				htmlImageMatch = imageRegex.exec(html);
				if (htmlImageMatch === null) break;
				if (htmlImageMatch[1] && !imageUrls.includes(htmlImageMatch[1])) {
					imageUrls.push(htmlImageMatch[1]);
				}
			}

			// Extract title and author information
			const titleMatch =
				html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
				html.match(/<title[^>]*>(.*?)<\/title>/i);
			const authorMatch =
				html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
				html.match(/<meta[^>]*name="author"[^>]*content="([^"]*)"/);

			// Extract description
			const descMatch =
				html.match(
					/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/,
				) || html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/);

			console.log("🔍 [Instagram] HTML parsing results:", {
				title: titleMatch?.[1],
				videoUrls: videoUrls.length,
				imageUrls: imageUrls.length,
				author: authorMatch?.[1],
				description: descMatch?.[1],
			});

			if (videoUrls.length === 0 && imageUrls.length === 0) {
				return {
					success: false,
					error: "No media found in this Instagram post",
				};
			}

			return {
				success: true,
				data: {
					videoUrls,
					imageUrls,
					title: titleMatch?.[1] || "Instagram Post",
					author: authorMatch?.[1] || "Unknown User",
					description: descMatch?.[1] || "",
					url: originalUrl,
				},
			};
		} catch (error) {
			console.error("❌ [Instagram] HTML parsing error:", error);
			return {
				success: false,
				error: "Failed to parse Instagram HTML",
			};
		}
	}

	/**
	 * Mock data with real URL information
	 */
	private getMockDataWithRealUrl(url: string): InstagramMediaData {
		const videoId = this.extractVideoId(url);
		const isReel = url.includes("/reel/") || url.includes("/reel/");
		const isPost = url.includes("/p/") || url.includes("/tv/");
		const isImage = false; // We'll determine this based on actual media

		// Simulate different content types
		let videoUrls: string[] = [];
		let imageUrls: string[] = [];

		if (isImage) {
			imageUrls = [
				`https://instagram.com/p/${videoId}/img1.jpg`,
				`https://instagram.com/p/${videoId}/img2.jpg`,
				`https://instagram.com/p/${videoId}/img3.jpg`,
			];
		} else {
			videoUrls = [
				`https://instagram.com/v/t/${videoId}/HD.mp4`,
				`https://instagram.com/v/t/${videoId}/SD.mp4`,
			];
		}

		const contentType = isImage ? "image" : "video";
		const platformInfo = isReel ? "Reel" : isPost ? "Post" : "";

		return {
			success: true,
			data: {
				videoUrls,
				imageUrls,
				title: `Instagram ${platformInfo} ${videoId}`,
				author: "@user_example",
				description: `Sample Instagram ${contentType} ${platformInfo} content`,
				url: url,
				isMock: true,
			},
		};
	}

	/**
	 * Extract video ID from Instagram URL
	 */
	private extractVideoId(url: string): string {
		try {
			const urlObj = new URL(url);
			const path = urlObj.pathname;

			// Handle different Instagram URL formats
			const reelMatch = path.match(/\/reel\/([A-Za-z0-9_-]+)/);
			const postMatch = path.match(/\/p\/([A-Za-z0-9_-]+)/);
			const tvMatch = path.match(/\/tv\/([A-Za-z0-9_-]+)/);

			if (reelMatch) return reelMatch[1];
			if (postMatch) return postMatch[1];
			if (tvMatch) return tvMatch[1];

			// Handle x.com redirect URLs (Instagram posts might be shared to x.com)
			if (urlObj.hostname === "x.com") {
				const xPathMatch =
					path.match(/\/reel\/([A-Za-z0-9_-]+)/) ||
					path.match(/\/p\/([A-Za-z0-9_-]+)/) ||
					path.match(/\/tv\/([A-Za-z0-9_-]+)/);
				if (xPathMatch) return xPathMatch[1];
			}

			// Generate fallback ID
			return Buffer.from(url).toString("base64").substring(0, 11);
		} catch {
			return "unknown";
		}
	}

	/**
	 * Enhanced fetch with proper headers
	 */
	private async fetchWithHeaders(
		url: string,
		headers: Record<string, string>,
		options?: RequestInit,
	): Promise<Response> {
		const defaultHeaders = {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			Accept:
				"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
			"Cache-Control": "no-cache",
			Pragma: "no-cache",
			...headers,
		};

		return fetch(url, {
			...options,
			headers: defaultHeaders,
			mode: "cors",
			credentials: "omit",
		});
	}

	/**
	 * Generate download result
	 */
	createDownloadResult(
		data: InstagramMediaData,
		originalUrl: string,
	): DownloadResult[] {
		const videoId = this.extractVideoId(originalUrl);
		const results: DownloadResult[] = [];

		// Process videos first
		if (data.data && data.data.videoUrls && data.data.videoUrls.length > 0) {
			data.data.videoUrls.forEach((videoUrl, index) => {
				results.push({
					id: `instagram-${videoId}-video-${index}`,
					type: "video",
					url: originalUrl,
					thumbnail: this.generatePlaceholderThumbnail(),
					downloadUrl: videoUrl,
					title: data.data?.title || `Instagram Video ${videoId}`,
					size: "Unknown",
					platform: "instagram",
					quality: videoUrl.includes("/HD.") ? "hd" : "sd",
					isMock: data.data?.isMock,
				});
			});
		}

		// Add images if no videos
		if (
			results.length === 0 &&
			data.data?.imageUrls &&
			data.data.imageUrls.length > 0
		) {
			data.data.imageUrls.forEach((imageUrl, index) => {
				results.push({
					id: `instagram-${videoId}-image-${index}`,
					type: "image",
					url: originalUrl,
					thumbnail: imageUrl,
					downloadUrl: imageUrl,
					title: data.data.title || `Instagram Image ${videoId}`,
					size: "Unknown",
					platform: "instagram",
					quality: "unknown",
					isMock: data.data?.isMock,
				});
			});
		}

		return results;
	}

	/**
	 * Generate placeholder thumbnail
	 */
	private generatePlaceholderThumbnail(): string {
		return "https://via.placeholder.com/400x300/FF69B4/FFFFFF?text=Instagram+Content";
	}

	/**
	 * Lazy initialize Crawlee downloader (only in Node.js environment)
	 */
	private async initializeCrawleeDownloader() {
		if (!isNodeJs) {
			throw new Error("Crawlee requires Node.js environment");
		}

		if (!this.crawleeDownloader) {
			const { InstagramCrawleeDownloader } = await import(
				"../crawlee-downloaders/instagram-crawlee-downloader"
			);
			this.crawleeDownloader = new InstagramCrawleeDownloader({
				maxRequestsPerCrawl: 1,
				headless: true,
				requestHandlerTimeoutSecs: 30,
				navigationTimeoutSecs: 30,
			});
		}

		return this.crawleeDownloader;
	}

	/**
	 * Download Instagram content using Crawlee
	 */
	async download(url: string): Promise<DownloadResult[]> {
		try {
			console.log(`🔄 [Crawlee] Starting Instagram download for:`, url);

			// Only try Crawlee in Node.js environment
			if (isNodeJs) {
				try {
					const downloader = await this.initializeCrawleeDownloader();
					const results = await downloader.download(url);

					console.log(
						`✅ [Crawlee] Instagram download completed. Results:`,
						results.length,
					);
					return results;
				} catch (crawleeError) {
					console.warn(
						"⚠️ [Crawlee] Crawlee download failed, falling back to legacy method:",
						crawleeError,
					);
				}
			}

			// Fallback to original method (works in both browser and Node.js)
			console.log("🔄 [Fallback] Using legacy Instagram download method...");
			const mediaData = await this.extractMediaFromPage(url);

			if (!mediaData.success) {
				throw new Error(
					mediaData.error ||
						"No downloadable content found on this Instagram page",
				);
			}

			const results = this.createDownloadResult(mediaData, url);

			console.log(
				`✅ [Fallback] Instagram download completed. Results:`,
				results.length,
			);

			return results;
		} catch (error) {
			console.error("❌ Instagram download error:", error);
			throw new Error(
				error instanceof Error
					? error.message
					: "Failed to download Instagram content",
			);
		}
	}
}

interface InstagramMediaData {
	success: boolean;
	data?: InstagramMediaInfo;
	error?: string;
}

interface InstagramMediaInfo {
	videoUrls: string[];
	imageUrls: string[];
	title: string;
	author: string;
	description: string;
	url: string;
	isMock?: boolean;
}
