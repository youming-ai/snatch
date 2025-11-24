import type { DownloadResult } from "@/types/download";
import { CrawleeDownloader, type CrawleeOptions } from "../crawlee-downloader";

/**
 * Instagram downloader using Crawlee with browser automation
 */
export class InstagramCrawleeDownloader extends CrawleeDownloader {
	constructor(options: CrawleeOptions = {}) {
		super("instagram", options);
	}

	/**
	 * Extract Instagram content ID from URL
	 */
	protected extractContentId(url: string): string {
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

			// Generate fallback ID
			return Buffer.from(url).toString("base64").substring(0, 11);
		} catch {
			return "unknown";
		}
	}

	/**
	 * Extract Instagram data from page using browser automation
	 */
	protected async extractFromPage(
		page: any,
		url: string,
		log: any,
	): Promise<any> {
		log.info("Extracting Instagram data from page...");

		try {
			// Wait for page to fully load
			try {
				await page.waitForNetworkIdle({ timeout: 15000 });
			} catch (e) {
				log.warning("Wait for network idle timed out, continuing...");
			}

			// Wait for Instagram specific elements
			await this.waitForSelectors(
				page,
				["article", "video", "img[src*='instagram']", "[role='button']"],
				10000,
			);

			// Extract Instagram data using page evaluation
			const instagramData = await page.evaluate(() => {
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
						comments: 0,
						shares: 0,
					},
					metadata: {
						contentType: "",
						isCarousel: false,
					},
				};

				// Method 1: Extract from window._sharedData
				const sharedDataScript = Array.from(
					document.querySelectorAll("script"),
				).find((script) => script.textContent?.includes("window._sharedData"));

				if (sharedDataScript && sharedDataScript.textContent) {
					try {
						const sharedDataMatch = sharedDataScript.textContent.match(
							/window\._sharedData\s*=\s*({.*?});/,
						);
						if (sharedDataMatch?.[1]) {
							const sharedData = JSON.parse(sharedDataMatch[1]);

							// Extract post data from sharedData
							const post_data =
								sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
							if (post_data) {
								result.content =
									post_data.edge_media_to_caption?.edges?.[0]?.node?.text || "";
								result.author = post_data.owner?.full_name || "";
								result.username = post_data.owner?.username || "";
								result.avatar = post_data.owner?.profile_pic_url || "";
								result.createdAt = post_data.taken_at_timestamp || "";

								// Engagement metrics
								result.engagement = {
									likes: post_data.edge_liked_by?.count || 0,
									comments: post_data.edge_media_to_comment?.count || 0,
									shares: 0, // Instagram doesn't expose share count
								};

								// Content type detection
								result.metadata.contentType = post_data.is_video
									? "video"
									: "image";
								result.metadata.isCarousel =
									post_data.edge_sidecar_to_children?.edges?.length > 1;

								// Video URLs
								if (post_data.is_video && post_data.video_url) {
									result.videoUrls.push(post_data.video_url);
								}

								// Thumbnail
								result.thumbnailUrl = post_data.display_url || "";

								// Carousel content
								if (result.metadata.isCarousel) {
									post_data.edge_sidecar_to_children.edges.forEach(
										(edge: any) => {
											const node = edge.node;
											if (node.is_video && node.video_url) {
												result.videoUrls.push(node.video_url);
											} else {
												result.imageUrls.push(node.display_url || "");
											}
										},
									);
								} else if (!post_data.is_video) {
									// Single image
									result.imageUrls.push(post_data.display_url || "");
								}
							}
						}
					} catch (e) {
						console.warn("Failed to parse window._sharedData:", e);
					}
				}

				// Method 2: DOM extraction if JSON parsing fails
				if (result.videoUrls.length === 0 && result.imageUrls.length === 0) {
					// Extract content from article
					const article = document.querySelector("article");
					if (article) {
						// Extract caption
						const captionElement = article.querySelector(
							"h1, [role='button'] + span",
						);
						if (captionElement) {
							result.content = captionElement.textContent || "";
						}

						// Extract author information
						const authorLink = article.querySelector("a[href*='/']");
						if (authorLink) {
							const usernameElement = authorLink.querySelector("span");
							result.username =
								usernameElement?.textContent?.replace("@", "") || "";
							result.author = result.username; // Instagram often shows username as name
						}

						// Extract avatar
						const avatarImg = article.querySelector(
							"img[alt*='profile picture'], img[alt*='avatar']",
						);
						if (avatarImg) {
							result.avatar = avatarImg.src || "";
						}
					}

					// Extract video elements
					document.querySelectorAll("article video").forEach((video) => {
						if (video.src) {
							result.videoUrls.push(video.src);
						}
						video.querySelectorAll("source").forEach((source) => {
							if (source.src) {
								result.videoUrls.push(source.src);
							}
						});
					});

					// Extract images from article
					document.querySelectorAll("article img").forEach((img) => {
						if (
							img.src &&
							!img.src.includes("data:") &&
							!img.src.includes("profile") &&
							!img.src.includes("avatar")
						) {
							result.imageUrls.push(img.src);

							// Use first image as thumbnail if not set
							if (!result.thumbnailUrl) {
								result.thumbnailUrl = img.src;
							}
						}
					});

					// Extract engagement metrics (approximate)
					const likeButton = document.querySelector(
						"article button[aria-label*='like'], article button[aria-label*='Like']",
					);
					if (likeButton) {
						const ariaLabel = likeButton.getAttribute("aria-label");
						if (ariaLabel) {
							const likesMatch = ariaLabel.match(/(\d+)/);
							result.engagement.likes = parseInt(likesMatch?.[1] || "0", 10);
						}
					}

					const commentButton = document.querySelector(
						"article button[aria-label*='comment'], article button[aria-label*='Comment']",
					);
					if (commentButton) {
						const ariaLabel = commentButton.getAttribute("aria-label");
						if (ariaLabel) {
							const commentsMatch = ariaLabel.match(/(\d+)/);
							result.engagement.comments = parseInt(
								commentsMatch?.[1] || "0",
								10,
							);
						}
					}

					// Determine content type
					if (result.videoUrls.length > 0) {
						result.metadata.contentType = "video";
					} else if (result.imageUrls.length > 1) {
						result.metadata.isCarousel = true;
						result.metadata.contentType = "carousel";
					} else {
						result.metadata.contentType = "image";
					}
				}

				// Extract title from meta tags
				const title = document.querySelector("title")?.textContent || "";
				const ogTitle =
					document
						.querySelector('meta[property="og:title"]')
						?.getAttribute("content") || "";
				result.title = result.content || title || ogTitle;

				// Extract thumbnail from meta tags if not found
				if (!result.thumbnailUrl) {
					const ogImage = document.querySelector('meta[property="og:image"]');
					if (ogImage) {
						result.thumbnailUrl = ogImage.getAttribute("content") || "";
					}
				}

				// Remove duplicates
				result.videoUrls = [...new Set(result.videoUrls)];
				result.imageUrls = [...new Set(result.imageUrls)];

				return result;
			});

			log.info("Instagram data extracted:", {
				title: instagramData.title,
				author: instagramData.author,
				username: instagramData.username,
				contentType: instagramData.metadata.contentType,
				videoUrls: instagramData.videoUrls.length,
				imageUrls: instagramData.imageUrls.length,
				isCarousel: instagramData.metadata.isCarousel,
				thumbnailUrl: instagramData.thumbnailUrl ? "found" : "not found",
			});

			return instagramData;
		} catch (error) {
			log.error("Error extracting Instagram data:", error);
			throw error;
		}
	}

	/**
	 * Download Instagram content using Crawlee
	 */
	async download(url: string): Promise<DownloadResult[]> {
		try {
			console.log(`🔄 [Crawlee] Starting Instagram download for:`, url);

			// Initialize crawler if not already done
			if (!this.isInitialized) {
				await this.initializeCrawler();
				this.isInitialized = true;
			}

			// Add URL to crawler
			await this.crawler.addRequests([url]);

			// Run crawler and collect results
			await this.crawler.run();

			// Get data from dataset
			const { Dataset } = await import("crawlee");
			const dataset = await Dataset.open();
			const { items } = await dataset.getData();
			const extractedData = items[0];

			if (!extractedData) {
				throw new Error("No Instagram content found on this page");
			}

			// Convert to DownloadResult format
			const downloadResults = this.createInstagramDownloadResults(
				extractedData,
				url,
			);
			console.log(
				`✅ [Crawlee] Instagram download completed. Results:`,
				downloadResults.length,
			);

			return downloadResults;
		} catch (error) {
			console.error("❌ [Crawlee] Instagram download error:", error);
			throw new Error(
				error instanceof Error
					? error.message
					: "Failed to download Instagram content",
			);
		}
	}

	/**
	 * Convert extracted Instagram data to DownloadResult format
	 */
	private createInstagramDownloadResults(
		extractedData: any,
		originalUrl: string,
	): DownloadResult[] {
		const results: DownloadResult[] = [];
		const contentId = this.extractContentId(originalUrl);
		const { metadata } = extractedData;

		// Add video results
		extractedData.videoUrls.forEach((videoUrl: string, index: number) => {
			const quality = this.determineQuality(videoUrl);
			const size = this.estimateFileSize(metadata.contentType, quality);

			results.push({
				id: `instagram-${contentId}-video-${index}`,
				type: "video",
				url: originalUrl,
				thumbnail:
					extractedData.thumbnailUrl || this.generatePlaceholderThumbnail(),
				downloadUrl: videoUrl,
				title:
					extractedData.title ||
					`Instagram ${metadata.contentType} by @${extractedData.username || "unknown"}`,
				size,
				platform: "instagram",
				quality,
			});
		});

		// Add image results if no videos
		if (results.length === 0 && extractedData.imageUrls.length > 0) {
			extractedData.imageUrls.forEach((imageUrl: string, index: number) => {
				results.push({
					id: `instagram-${contentId}-image-${index}`,
					type: "image",
					url: originalUrl,
					thumbnail: imageUrl,
					downloadUrl: imageUrl,
					title:
						extractedData.title ||
						`Instagram ${metadata.contentType} by @${extractedData.username || "unknown"}`,
					size: "Unknown",
					platform: "instagram",
					quality: "unknown",
				});
			});
		}

		// If no media found, add fallback result
		if (results.length === 0) {
			results.push({
				id: `instagram-${contentId}-fallback`,
				type: metadata.contentType === "video" ? "video" : "image",
				url: originalUrl,
				thumbnail:
					extractedData.thumbnailUrl || this.generatePlaceholderThumbnail(),
				downloadUrl: "",
				title:
					extractedData.title ||
					`Instagram ${metadata.contentType} by @${extractedData.username || "unknown"}`,
				size: "Unknown",
				platform: "instagram",
				quality: "unknown",
				isMock: true,
			});
		}

		return results;
	}

	/**
	 * Estimate file size based on content type and quality
	 */
	private estimateFileSize(contentType: string, quality: string): string {
		if (contentType === "video") {
			// Instagram videos are typically 2-15MB
			const baseSize = quality === "hd" ? 8 : 4; // MB
			const variation = Math.random() * 4; // ±4MB variation
			return `${(baseSize + variation).toFixed(1)} MB`;
		} else {
			// Instagram images are typically 0.5-3MB
			const baseSize = 1.5; // MB
			const variation = Math.random() * 1.5; // ±1.5MB variation
			return `${(baseSize + variation).toFixed(1)} MB`;
		}
	}
}
