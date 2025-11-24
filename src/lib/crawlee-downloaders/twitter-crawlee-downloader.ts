import type { DownloadResult } from "@/types/download";
import { CrawleeDownloader, type CrawleeOptions } from "../crawlee-downloader";

/**
 * Twitter/X downloader using Crawlee with browser automation
 */
export class TwitterCrawleeDownloader extends CrawleeDownloader {
	constructor(options: CrawleeOptions = {}) {
		super("twitter", options);
	}

	/**
	 * Extract Twitter content ID from URL
	 */
	protected extractContentId(url: string): string {
		try {
			const urlObj = new URL(url);
			const path = urlObj.pathname;

			// Handle different Twitter/X URL formats
			const statusMatch = path.match(/\/status\/(\d+)/);
			const userNameStatusMatch = path.match(/\/[^/]+\/status\/(\d+)/);

			if (statusMatch) return statusMatch[1];
			if (userNameStatusMatch) return userNameStatusMatch[1];

			// Generate fallback ID
			return Buffer.from(url).toString("base64").substring(0, 11);
		} catch {
			return "unknown";
		}
	}

	/**
	 * Extract Twitter data from page using browser automation
	 */
	protected async extractFromPage(
		page: any,
		url: string,
		log: any,
	): Promise<any> {
		log.info("Extracting Twitter/X data from page...");

		try {
			// Wait for page to fully load
			await page.waitForLoadState("networkidle", { timeout: 15000 });

			// Wait for Twitter specific elements
			await this.waitForSelectors(
				page,
				[
					"[data-testid='tweet']",
					"[data-testid='tweetText']",
					"video",
					"[data-testid='videoPlayer']",
				],
				10000,
			);

			// Extract Twitter data using page evaluation
			const twitterData = await page.evaluate(() => {
				const result: any = {
					title: "",
					content: "",
					author: "",
					username: "",
					avatar: "",
					createdAt: "",
					videoUrls: [],
					imageUrls: [],
					thumbnailUrl: "",
					engagement: {
						likes: 0,
						retweets: 0,
						comments: 0,
						views: 0,
					},
					metadata: {},
				};

				// Method 1: Extract from __INITIAL_STATE__
				const stateScript = document.querySelector("script:not([src])");
				if (stateScript && stateScript.textContent) {
					try {
						const stateMatch = stateScript.textContent.match(
							/window\.__INITIAL_STATE__\s*=\s*(.*?)(?:;?\s*<\/script>|;\s*window)/,
						);
						if (stateMatch?.[1]) {
							let jsonStr = stateMatch[1].trim();
							if (jsonStr.endsWith(";")) {
								jsonStr = jsonStr.slice(0, -1);
							}
							const state = JSON.parse(jsonStr);

							// Extract tweet ID from URL
							const urlObj = new URL(window.location.href);
							const pathMatch = urlObj.pathname.match(/\/status\/(\d+)/);
							const tweetId = pathMatch?.[1];

							if (tweetId && state.entities?.tweets?.entities?.[tweetId]) {
								const tweet = state.entities.tweets.entities[tweetId];

								result.content = tweet.full_text || tweet.text || "";
								result.author =
									state.entities.users.entities[tweet.user_id_str]?.name || "";
								result.username =
									state.entities.users.entities[tweet.user_id_str]
										?.screen_name || "";
								result.avatar =
									state.entities.users.entities[tweet.user_id_str]
										?.profile_image_url_https || "";
								result.createdAt = tweet.created_at || "";

								// Engagement metrics
								result.engagement = {
									likes: tweet.favorite_count || 0,
									retweets: tweet.retweet_count || 0,
									comments: tweet.reply_count || 0,
									views: 0, // Not available in this structure
								};

								// Media extraction
								if (tweet.extended_entities?.media) {
									tweet.extended_entities.media.forEach((media: any) => {
										if (media.type === "video" && media.video_info?.variants) {
											// Find the best quality video variant
											const variants = media.video_info.variants
												.filter((v: any) => v.content_type === "video/mp4")
												.sort(
													(a: any, b: any) =>
														(b.bitrate || 0) - (a.bitrate || 0),
												);

											if (variants.length > 0) {
												result.videoUrls.push(variants[0].url);
											}

											// Use first media image as thumbnail
											if (!result.thumbnailUrl) {
												result.thumbnailUrl = media.media_url_https || "";
											}
										} else if (media.type === "photo") {
											result.imageUrls.push(media.media_url_https || "");
											if (!result.thumbnailUrl) {
												result.thumbnailUrl = media.media_url_https || "";
											}
										}
									});
								}
							}
						}
					} catch (e) {
						console.warn("Failed to parse __INITIAL_STATE__:", e);
					}
				}

				// Method 2: DOM extraction if JSON parsing fails
				if (result.videoUrls.length === 0) {
					// Extract tweet text
					const tweetText = document.querySelector("[data-testid='tweetText']");
					if (tweetText) {
						result.content = tweetText.textContent || "";
					}

					// Extract author information
					const authorElement = document.querySelector(
						"[data-testid='User-Name']",
					);
					if (authorElement) {
						const authorName = authorElement.querySelector("a span");
						const username = authorElement.querySelector(
							"a[href*='/'] span:last-child",
						);
						result.author = authorName?.textContent || "";
						result.username = username?.textContent?.replace("@", "") || "";
					}

					// Extract avatar
					const avatarElement = document.querySelector(
						"[data-testid='UserAvatar'] img",
					);
					if (avatarElement) {
						result.avatar = avatarElement.src || "";
					}

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

					// Extract images
					document
						.querySelectorAll("[data-testid='tweetPhoto'] img")
						.forEach((img) => {
							if (img.src && !img.src.includes("data:")) {
								result.imageUrls.push(img.src);
							}
						});

					// Extract engagement metrics
					const likesElement = document.querySelector("[data-testid='like']");
					if (likesElement) {
						const likesText = likesElement.getAttribute("aria-label");
						if (likesText) {
							const likesMatch = likesText.match(/(\d+)/);
							result.engagement.likes = parseInt(likesMatch?.[1] || "0", 10);
						}
					}

					const retweetsElement = document.querySelector(
						"[data-testid='retweet']",
					);
					if (retweetsElement) {
						const retweetsText = retweetsElement.getAttribute("aria-label");
						if (retweetsText) {
							const retweetsMatch = retweetsText.match(/(\d+)/);
							result.engagement.retweets = parseInt(
								retweetsMatch?.[1] || "0",
								10,
							);
						}
					}

					const commentsElement = document.querySelector(
						"[data-testid='reply']",
					);
					if (commentsElement) {
						const commentsText = commentsElement.getAttribute("aria-label");
						if (commentsText) {
							const commentsMatch = commentsText.match(/(\d+)/);
							result.engagement.comments = parseInt(
								commentsMatch?.[1] || "0",
								10,
							);
						}
					}

					// Extract thumbnail from meta tags if not found
					if (!result.thumbnailUrl) {
						const ogImage = document.querySelector('meta[property="og:image"]');
						if (ogImage) {
							result.thumbnailUrl = ogImage.getAttribute("content") || "";
						}
					}
				}

				// Extract title from meta tags
				const title = document.querySelector("title")?.textContent || "";
				const ogTitle =
					document
						.querySelector('meta[property="og:title"]')
						?.getAttribute("content") || "";
				result.title = result.content || title || ogTitle;

				// Remove duplicates
				result.videoUrls = [...new Set(result.videoUrls)];
				result.imageUrls = [...new Set(result.imageUrls)];

				return result;
			});

			log.info("Twitter/X data extracted:", {
				title: twitterData.title,
				author: twitterData.author,
				username: twitterData.username,
				videoUrls: twitterData.videoUrls.length,
				imageUrls: twitterData.imageUrls.length,
				thumbnailUrl: twitterData.thumbnailUrl ? "found" : "not found",
			});

			return twitterData;
		} catch (error) {
			log.error("Error extracting Twitter/X data:", error);
			throw error;
		}
	}

	/**
	 * Download Twitter/X content using Crawlee
	 */
	async download(url: string): Promise<DownloadResult[]> {
		try {
			console.log(`🔄 [Crawlee] Starting Twitter/X download for:`, url);

			// Add URL to crawler
			await this.crawler.addRequests([url]);

			// Run crawler and collect results
			const results = await this.crawler.run();

			// Get data from dataset
			const dataset = await this.crawler.getData();
			const extractedData = dataset.items[0];

			if (!extractedData) {
				throw new Error("No Twitter/X content found on this page");
			}

			// Convert to DownloadResult format
			const downloadResults = this.createTwitterDownloadResults(
				extractedData,
				url,
			);
			console.log(
				`✅ [Crawlee] Twitter/X download completed. Results:`,
				downloadResults.length,
			);

			return downloadResults;
		} catch (error) {
			console.error("❌ [Crawlee] Twitter/X download error:", error);
			throw new Error(
				error instanceof Error
					? error.message
					: "Failed to download Twitter/X content",
			);
		}
	}

	/**
	 * Convert extracted Twitter data to DownloadResult format
	 */
	private createTwitterDownloadResults(
		extractedData: any,
		originalUrl: string,
	): DownloadResult[] {
		const results: DownloadResult[] = [];
		const contentId = this.extractContentId(originalUrl);

		// Add video results
		extractedData.videoUrls.forEach((videoUrl: string, index: number) => {
			const quality = this.determineQuality(videoUrl);
			const size = this.estimateFileSize(quality);

			results.push({
				id: `twitter-${contentId}-video-${index}`,
				type: "video",
				url: originalUrl,
				thumbnail:
					extractedData.thumbnailUrl || this.generatePlaceholderThumbnail(),
				downloadUrl: videoUrl,
				title:
					extractedData.title ||
					extractedData.content ||
					`Twitter/X Tweet by @${extractedData.username || "unknown"}`,
				size,
				platform: "twitter",
				quality,
			});
		});

		// Add image results if no videos
		if (results.length === 0 && extractedData.imageUrls.length > 0) {
			extractedData.imageUrls.forEach((imageUrl: string, index: number) => {
				results.push({
					id: `twitter-${contentId}-image-${index}`,
					type: "image",
					url: originalUrl,
					thumbnail: imageUrl,
					downloadUrl: imageUrl,
					title:
						extractedData.title ||
						extractedData.content ||
						`Twitter/X Tweet by @${extractedData.username || "unknown"}`,
					size: "Unknown",
					platform: "twitter",
					quality: "unknown",
				});
			});
		}

		// If no media found, add fallback result
		if (results.length === 0) {
			results.push({
				id: `twitter-${contentId}-fallback`,
				type: "video",
				url: originalUrl,
				thumbnail:
					extractedData.thumbnailUrl || this.generatePlaceholderThumbnail(),
				downloadUrl: "",
				title:
					extractedData.title ||
					extractedData.content ||
					`Twitter/X Tweet by @${extractedData.username || "unknown"}`,
				size: "Unknown",
				platform: "twitter",
				quality: "unknown",
				isMock: true,
			});
		}

		return results;
	}

	/**
	 * Estimate file size for Twitter videos
	 */
	private estimateFileSize(quality: string): string {
		// Twitter videos are typically 1-8MB depending on quality
		const baseSize = quality === "hd" ? 5 : 2.5; // MB
		const variation = Math.random() * 2; // ±2MB variation
		return `${(baseSize + variation).toFixed(1)} MB`;
	}
}
