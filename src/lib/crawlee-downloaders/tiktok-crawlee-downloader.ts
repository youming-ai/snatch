import type { DownloadResult } from "@/types/download";
import { CrawleeDownloader, type CrawleeOptions } from "../crawlee-downloader";

/**
 * TikTok downloader using Crawlee with browser automation
 */
export class TikTokCrawleeDownloader extends CrawleeDownloader {
	constructor(options: CrawleeOptions = {}) {
		super("tiktok", options);
	}

	/**
	 * Extract TikTok content ID from URL
	 */
	protected extractContentId(url: string): string {
		try {
			const urlObj = new URL(url);
			const path = urlObj.pathname;

			// Handle different TikTok URL formats
			const videoMatch = path.match(/\/video\/(\d+)/);
			const userVideoMatch = path.match(/\/@[^/]+\/video\/(\d+)/);

			if (videoMatch) return videoMatch[1];
			if (userVideoMatch) return userVideoMatch[1];

			// Handle shortened URLs
			const shortCodeMatch = path.match(/([A-Za-z0-9_-]+)$/);
			if (shortCodeMatch) {
				return shortCodeMatch[1];
			}

			// Generate fallback ID
			return Buffer.from(url).toString("base64").substring(0, 11);
		} catch {
			return "unknown";
		}
	}

	/**
	 * Extract TikTok data from page using browser automation
	 */
	protected async extractFromPage(
		page: any,
		url: string,
		log: any,
	): Promise<any> {
		log.info("Extracting TikTok data from page...");

		try {
			// Wait for page to fully load
			await page.waitForLoadState("networkidle", { timeout: 15000 });

			// Wait for TikTok specific elements
			await this.waitForSelectors(
				page,
				[
					"[data-e2e='video-player']",
					"video",
					"[data-e2e='browse-video-desc']",
				],
				10000,
			);

			// Extract TikTok data using page evaluation
			const tiktokData = await page.evaluate(() => {
				const result: any = {
					title: "",
					author: "",
					username: "",
					videoUrls: [],
					imageUrls: [],
					thumbnailUrl: "",
					engagement: {
						likes: 0,
						shares: 0,
						comments: 0,
						views: 0,
					},
					metadata: {},
				};

				// Method 1: Extract from __UNIVERSAL_DATA_FOR_REHYDRATION__
				const universalScript = document.getElementById(
					"__UNIVERSAL_DATA_FOR_REHYDRATION__",
				);
				if (universalScript) {
					try {
						const universalData = JSON.parse(universalScript.textContent || "");
						const videoDetail =
							universalData?.__DEFAULT_SCOPE__?.["webapp.video-detail"];

						if (videoDetail?.itemInfo?.itemStruct) {
							const item = videoDetail.itemInfo.itemStruct;

							result.title = item.desc || "";
							result.author = item.author?.nickname || "";
							result.username = item.author?.uniqueId || "";

							// Video URLs
							if (item.video?.downloadAddr?.[0]?.url) {
								result.videoUrls.push(item.video.downloadAddr[0].url);
							}
							if (item.video?.playAddr) {
								result.videoUrls.push(item.video.playAddr);
							}

							// Thumbnail
							result.thumbnailUrl =
								item.video?.cover || item.video?.shareCover || "";

							// Engagement metrics
							result.engagement = {
								likes: item.stats?.diggCount || 0,
								shares: item.stats?.shareCount || 0,
								comments: item.stats?.commentCount || 0,
								views: item.stats?.playCount || 0,
							};

							result.metadata = {
								duration: item.video?.duration || 0,
								createTime: item.createTime,
								musicTitle: item.music?.title,
								musicAuthor: item.music?.authorName,
							};
						}
					} catch (e) {
						console.warn(
							"Failed to parse __UNIVERSAL_DATA_FOR_REHYDRATION__:",
							e,
						);
					}
				}

				// Method 2: Extract from SIGI_STATE if universal data fails
				if (result.videoUrls.length === 0) {
					const sigiScript = document.getElementById("SIGI_STATE");
					if (sigiScript) {
						try {
							const sigiData = JSON.parse(sigiScript.textContent || "");
							const urlObj = new URL(window.location.href);
							const path = urlObj.pathname;
							const videoMatch = path.match(/\/video\/(\d+)/);
							const userVideoMatch = path.match(/\/@[^/]+\/video\/(\d+)/);
							const videoId = videoMatch?.[1] || userVideoMatch?.[1];

							if (videoId && sigiData.ItemModule?.[videoId]) {
								const item = sigiData.ItemModule[videoId];

								result.title = item.desc || "";
								result.author = item.author?.nickname || "";
								result.username = item.author?.uniqueId || "";

								// Video URLs
								if (item.video?.downloadAddr?.[0]?.url) {
									result.videoUrls.push(item.video.downloadAddr[0].url);
								}
								if (item.video?.playAddr) {
									result.videoUrls.push(item.video.playAddr);
								}

								// Thumbnail
								result.thumbnailUrl =
									item.video?.cover || item.video?.shareCover || "";

								// Engagement metrics
								result.engagement = {
									likes: item.stats?.diggCount || 0,
									shares: item.stats?.shareCount || 0,
									comments: item.stats?.commentCount || 0,
									views: item.stats?.playCount || 0,
								};
							}
						} catch (e) {
							console.warn("Failed to parse SIGI_STATE:", e);
						}
					}
				}

				// Method 3: Fallback - DOM extraction
				if (result.videoUrls.length === 0) {
					// Extract video elements
					document.querySelectorAll("video").forEach((video) => {
						if (video.src) {
							result.videoUrls.push(video.src);
						}
						video.querySelectorAll("source").forEach((source) => {
							if (source.src) {
								result.videoUrls.push(source.src);
							}
						});
					});

					// Extract from meta tags
					const title = document.querySelector("title")?.textContent || "";
					const ogTitle =
						document
							.querySelector('meta[property="og:title"]')
							?.getAttribute("content") || "";
					const ogImage =
						document
							.querySelector('meta[property="og:image"]')
							?.getAttribute("content") || "";

					result.title = result.title || title || ogTitle;
					result.thumbnailUrl = result.thumbnailUrl || ogImage;

					// Try to extract username from URL
					const usernameMatch = window.location.pathname.match(/\/@([^/]+)/);
					if (usernameMatch) {
						result.username = usernameMatch[1];
						result.author = `@${usernameMatch[1]}`;
					}
				}

				// Remove duplicate video URLs
				result.videoUrls = [...new Set(result.videoUrls)];
				result.imageUrls = [...new Set(result.imageUrls)];

				return result;
			});

			log.info("TikTok data extracted:", {
				title: tiktokData.title,
				author: tiktokData.author,
				videoUrls: tiktokData.videoUrls.length,
				thumbnailUrl: tiktokData.thumbnailUrl ? "found" : "not found",
			});

			return tiktokData;
		} catch (error) {
			log.error("Error extracting TikTok data:", error);
			throw error;
		}
	}

	/**
	 * Download TikTok content using Crawlee
	 */
	async download(url: string): Promise<DownloadResult[]> {
		try {
			console.log(`🔄 [Crawlee] Starting TikTok download for:`, url);

			// Add URL to crawler
			await this.crawler.addRequests([url]);

			// Run crawler and collect results
			const results = await this.crawler.run();

			// Get data from dataset
			const dataset = await this.crawler.getData();
			const extractedData = dataset.items[0];

			if (!extractedData) {
				throw new Error("No TikTok content found on this page");
			}

			// Convert to DownloadResult format
			const downloadResults = this.createTikTokDownloadResults(
				extractedData,
				url,
			);
			console.log(
				`✅ [Crawlee] TikTok download completed. Results:`,
				downloadResults.length,
			);

			return downloadResults;
		} catch (error) {
			console.error("❌ [Crawlee] TikTok download error:", error);
			throw new Error(
				error instanceof Error
					? error.message
					: "Failed to download TikTok content",
			);
		}
	}

	/**
	 * Convert extracted TikTok data to DownloadResult format
	 */
	private createTikTokDownloadResults(
		extractedData: any,
		originalUrl: string,
	): DownloadResult[] {
		const results: DownloadResult[] = [];
		const contentId = this.extractContentId(originalUrl);

		// Add video results
		extractedData.videoUrls.forEach((videoUrl: string, index: number) => {
			const quality = this.determineQuality(videoUrl);
			const size = this.estimateFileSize(
				extractedData.metadata?.duration || 30,
				quality,
			);

			results.push({
				id: `tiktok-${contentId}-video-${index}`,
				type: "video",
				url: originalUrl,
				thumbnail:
					extractedData.thumbnailUrl || this.generatePlaceholderThumbnail(),
				downloadUrl: videoUrl,
				title:
					extractedData.title ||
					`TikTok Video by ${extractedData.author || "unknown"}`,
				size,
				platform: "tiktok",
				quality,
			});
		});

		// If no videos found, add fallback result
		if (results.length === 0) {
			results.push({
				id: `tiktok-${contentId}-fallback`,
				type: "video",
				url: originalUrl,
				thumbnail:
					extractedData.thumbnailUrl || this.generatePlaceholderThumbnail(),
				downloadUrl: "",
				title:
					extractedData.title ||
					`TikTok Video by ${extractedData.author || "unknown"}`,
				size: "Unknown",
				platform: "tiktok",
				quality: "unknown",
				isMock: true,
			});
		}

		return results;
	}

	/**
	 * Estimate file size based on duration and quality
	 */
	private estimateFileSize(duration: number, quality: string): string {
		// Rough estimate: TikTok videos are typically 1-5MB per 15 seconds
		const baseSizePerSecond = quality === "hd" ? 0.15 : 0.08; // MB per second
		const fileSize = (duration * baseSizePerSecond) / 15; // Convert to MB
		return `${fileSize.toFixed(1)} MB`;
	}
}
