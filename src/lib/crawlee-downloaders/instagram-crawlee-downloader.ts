import type { DownloadResult } from "@/types/download";
import {
	EnhancedCrawleeDownloader,
	type EnhancedCrawleeOptions,
	CrawleeErrorType,
	CrawleeError,
	type ExtractedData,
} from "../enhanced-crawlee-downloader";

/**
 * Enhanced Instagram downloader using Crawlee with improved error handling and retry mechanisms
 */
export class InstagramCrawleeDownloader extends EnhancedCrawleeDownloader {
	constructor(options: EnhancedCrawleeOptions = {}) {
		super("instagram", {
			...options,
			// Enhanced retry configuration for Instagram
			retryConfig: {
				maxRetries: 3,
				initialDelay: 1500,
				maxDelay: 30000,
				backoffFactor: 2,
				...options.retryConfig,
			},
			// Platform-specific configuration
			platformConfig: {
				// Elements to wait for before extraction
				waitForElements: [
					"article",
					"video",
					"img[src*='instagram']",
					"[role='button']",
					"[data-test-id='post-container']",
				],
				// Data selectors for extraction
				dataSelectors: [
					"script[type='application/json']",
					"script:not([src])",
					"[data-test-id='post-container']",
					"article",
				],
				// Additional configuration for Instagram
				extractionTimeout: 20000,
				maxScrollAttempts: 2,
				...options.platformConfig,
			},
		});
	}

	/**
	 * Extract Instagram content ID from URL with enhanced patterns
	 */
	protected extractContentId(url: string): string {
		try {
			const urlObj = new URL(url);
			const path = urlObj.pathname;

			// Handle different Instagram URL formats
			const patterns = [
				/\/reel\/([A-Za-z0-9_-]+)/i,
				/\/p\/([A-Za-z0-9_-]+)/i,
				/\/tv\/([A-Za-z0-9_-]+)/i,
			];

			for (const pattern of patterns) {
				const match = path.match(pattern);
				if (match) return match[1];
			}

			// Generate fallback ID
			return Buffer.from(url).toString("base64").substring(0, 11);
		} catch {
			return "unknown";
		}
	}

	/**
	 * Enhanced Instagram data extraction with multiple fallback strategies
	 */
	protected async extractFromPage(
		page: any,
		url: string,
		log: any,
	): Promise<ExtractedData | null> {
		log.info("Starting enhanced Instagram data extraction...");

		try {
			const config = this.options.platformConfig || {};

			// Strategy 1: Enhanced page loading
			await this.loadInstagramPage(page, log);

			// Strategy 2: Multi-method data extraction
			const extractedData = await this.extractInstagramDataWithStrategies(
				page,
				log,
				config,
			);

			// Strategy 3: Fallback extraction if main strategies fail
			if (
				!extractedData ||
				(extractedData.videoUrls.length === 0 &&
					extractedData.imageUrls.length === 0)
			) {
				log.warning("Main extraction strategies failed, trying fallback...");
				return await this.fallbackExtraction(page, url, log);
			}

			return extractedData;
		} catch (error) {
			log.error("Instagram data extraction failed:", error);
			throw new CrawleeError(
				CrawleeErrorType.PARSING_ERROR,
				"Failed to extract Instagram data from page",
				this.platform,
				error as Error,
			);
		}
	}

	/**
	 * Enhanced Instagram page loading with multiple strategies
	 */
	private async loadInstagramPage(page: any, log: any): Promise<void> {
		log.info("Loading Instagram page with enhanced strategies...");

		try {
			// Wait for initial network idle
			await page.waitForLoadState("networkidle", { timeout: 25000 });

			// Additional wait for dynamic content
			await page.waitForTimeout(3000);

			// Try scrolling to trigger content loading
			await this.retryOperation(
				async () => {
					await page.evaluate(() => {
						window.scrollTo(0, document.body.scrollHeight / 2);
					});
					await page.waitForTimeout(2000);
				},
				"Scroll to load content",
				log,
				2,
			);

			log.info("Instagram page loaded successfully");
		} catch (error) {
			log.warning("Instagram page loading issues, continuing anyway:", error);
		}
	}

	/**
	 * Multi-strategy Instagram data extraction
	 */
	private async extractInstagramDataWithStrategies(
		page: any,
		log: any,
		config: any,
	): Promise<ExtractedData | null> {
		const strategies = [
			() => this.extractFromSharedData(page, log),
			() => this.extractFromGqlData(page, log),
			() => this.extractFromDOMElements(page, log),
			() => this.extractFromEmbedData(page, log),
		];

		for (const strategy of strategies) {
			try {
				log.info("Trying Instagram extraction strategy...");
				const data = await strategy();
				if (data && (data.videoUrls.length > 0 || data.imageUrls.length > 0)) {
					log.info("Instagram extraction strategy successful");
					return data;
				}
			} catch (error) {
				log.warning("Instagram extraction strategy failed:", error);
			}
		}

		return null;
	}

	/**
	 * Extract data from window._sharedData
	 */
	private async extractFromSharedData(
		page: any,
		log: any,
	): Promise<ExtractedData | null> {
		return await this.evaluatePage(() => {
			const sharedDataScript = Array.from(
				document.querySelectorAll("script"),
			).find((script) => script.textContent?.includes("window._sharedData"));

			if (!sharedDataScript?.textContent) return null;

			try {
				const sharedDataMatch = sharedDataScript.textContent.match(
					/window\._sharedData\s*=\s*({.*?});/,
				);
				if (!sharedDataMatch?.[1]) return null;

				const sharedData = JSON.parse(sharedDataMatch[1]);
				const postData =
					sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;

				if (!postData) return null;

				const result: ExtractedData = {
					title: "",
					author: postData.owner?.full_name || "",
					username: postData.owner?.username || "",
					videoUrls: [],
					imageUrls: [],
					thumbnailUrl: postData.display_url || "",
					engagement: {
						likes: postData.edge_liked_by?.count || 0,
						comments: postData.edge_media_to_comment?.count || 0,
						shares: 0, // Instagram doesn't expose share count
						views: postData.video_view_count || 0,
					},
					metadata: {
						contentType: postData.is_video ? "video" : "image",
						isCarousel: postData.edge_sidecar_to_children?.edges?.length > 1,
						duration: postData.video_duration || 0,
						videoWidth: postData.dimensions?.width,
						videoHeight: postData.dimensions?.height,
						location: postData.location?.name,
						taggedUsers: postData.edge_media_to_tagged_user?.edges?.map(
							(edge: any) => edge.node.user.username,
						),
						timestamp: postData.taken_at_timestamp,
						isSponsored: postData.is_sponsored,
					},
					platformSpecific: {
						itemId: postData.id,
						ownerPk: postData.owner?.pk,
						trackingPixel: postData.trackingPixel,
						viewerHasLiked: postData.viewer_has_liked,
						viewerHasSaved: postData.viewer_has_saved,
						viewerHasLikedCaption: postData.viewer_has_liked_caption,
					},
				};

				// Extract content/caption
				result.title =
					postData.edge_media_to_caption?.edges?.[0]?.node?.text || "";

				// Extract video URLs
				if (postData.is_video && postData.video_url) {
					result.videoUrls.push(postData.video_url);
				}

				// Extract carousel content
				if (result.metadata?.isCarousel) {
					postData.edge_sidecar_to_children.edges.forEach((edge: any) => {
						const node = edge.node;
						if (node.is_video && node.video_url) {
							result.videoUrls.push(node.video_url);
						} else {
							result.imageUrls.push(node.display_url || "");
						}
					});
				} else if (!postData.is_video) {
					// Single image
					result.imageUrls.push(postData.display_url || "");
				}

				// Remove duplicates and filter valid URLs
				result.videoUrls = [
					...new Set(
						result.videoUrls.filter((url) => url && url.startsWith("http")),
					),
				];
				result.imageUrls = [
					...new Set(
						result.imageUrls.filter((url) => url && url.startsWith("http")),
					),
				];

				return result;
			} catch (error) {
				console.warn("Failed to parse window._sharedData:", error);
				return null;
			}
		}, "window._sharedData extraction");
	}

	/**
	 * Extract data from GraphQL data (newer Instagram)
	 */
	private async extractFromGqlData(
		page: any,
		log: any,
	): Promise<ExtractedData | null> {
		return await this.evaluatePage(() => {
			// Look for GraphQL data in script tags
			const scripts = Array.from(
				document.querySelectorAll("script[type='application/json'], script"),
			);

			for (const script of scripts) {
				if (!script.textContent) continue;

				try {
					const data = JSON.parse(script.textContent);
					const jsonStr = JSON.stringify(data);

					// Look for media URL patterns in the JSON
					const videoUrlMatches = jsonStr.match(
						/https:\/\/[^"\s]+\.(?:mp4|mov|webm)(?:\?[^"\s]*)?/gi,
					);
					const imageUrlMatches = jsonStr.match(
						/https:\/\/[^"\s]+instagram\.com[^"\s]*\.(?:jpg|jpeg|png)(?:\?[^"\s]*)?/gi,
					);

					if (videoUrlMatches.length > 0 || imageUrlMatches.length > 0) {
						// Extract basic metadata from page
						const title = document.querySelector("title")?.textContent || "";
						const ogImage = document.querySelector('meta[property="og:image"]');

						return {
							title: title || "Instagram Post",
							videoUrls: [
								...new Set(
									videoUrlMatches.filter((url) => url.includes("instagram")),
								),
							],
							imageUrls: [...new Set(imageUrlMatches)],
							thumbnailUrl: ogImage?.getAttribute("content") || "",
							platformSpecific: {
								source: "GraphQL extraction",
							},
						} as ExtractedData;
					}
				} catch (e) {
					// Continue to next script
				}
			}

			return null;
		}, "GraphQL data extraction");
	}

	/**
	 * Extract data from DOM elements
	 */
	private async extractFromDOMElements(
		page: any,
		log: any,
	): Promise<ExtractedData | null> {
		try {
			const metadata = await this.extractMetadata(page);
			const videoUrls = await this.extractVideoUrls(page);
			const imageUrls = await this.extractImageUrls(page);

			// Enhanced title and author extraction
			const contentInfo = await this.evaluatePage(() => {
				// Extract from article element
				const article = document.querySelector("article");
				if (!article) return { content: "", author: "", username: "" };

				// Extract caption
				const captionSelectors = [
					"h1",
					"[role='button'] + span",
					"div[role='button'] span",
					".C4VMK",
					".x7a106z",
					".x1i10hfl",
				];

				let content = "";
				for (const selector of captionSelectors) {
					const element = article.querySelector(selector);
					if (element?.textContent?.trim()) {
						content = element.textContent.trim();
						break;
					}
				}

				// Extract author information
				const authorSelectors = [
					"a[href*='/'] span",
					"[data-test-id='post-container'] a span",
					".x1i10hfl span",
					".x193iq5w",
				];

				let author = "";
				let username = "";
				for (const selector of authorSelectors) {
					const element = article.querySelector(selector);
					if (element?.textContent?.trim()) {
						const text = element.textContent.trim();
						if (
							!text.includes("view") &&
							!text.includes("like") &&
							!text.includes("comment")
						) {
							author = text;
							username = text.replace("@", "");
							break;
						}
					}
				}

				return { content, author, username };
			}, "Instagram content extraction");

			return {
				...metadata,
				title: contentInfo.content || metadata.title,
				author: contentInfo.author || metadata.author,
				username: contentInfo.username || metadata.username,
				videoUrls,
				imageUrls,
				engagement: {
					likes: await this.extractEngagementCount(page, "like"),
					comments: await this.extractEngagementCount(page, "comment"),
					shares: 0, // Instagram doesn't expose share count in DOM
				},
				metadata: {
					...metadata.metadata,
					contentType: videoUrls.length > 0 ? "video" : "image",
					isCarousel: imageUrls.length > 1,
				},
				platformSpecific: {
					source: "DOM extraction",
				},
			};
		} catch (error) {
			log.warning("Instagram DOM extraction failed:", error);
			return null;
		}
	}

	/**
	 * Extract data from embed data
	 */
	private async extractFromEmbedData(
		page: any,
		log: any,
	): Promise<ExtractedData | null> {
		return await this.evaluatePage(() => {
			// Look for embed data in page
			const embedData = window.__ig_d || window._sharedEmbedData;

			if (embedData && embedData.media) {
				const media = embedData.media;

				return {
					title: media.caption || "",
					author: media.user?.full_name || media.user?.username || "",
					username: media.user?.username || "",
					videoUrls: media.video_url ? [media.video_url] : [],
					imageUrls: media.display_url ? [media.display_url] : [],
					thumbnailUrl: media.display_url || "",
					engagement: {
						likes: media.likes || 0,
						comments: media.comments || 0,
					},
					platformSpecific: {
						source: "Embed data",
					},
				} as ExtractedData;
			}

			return null;
		}, "Embed data extraction");
	}

	/**
	 * Extract engagement count from page
	 */
	private async extractEngagementCount(
		page: any,
		type: "like" | "comment",
	): Promise<number> {
		try {
			return await this.evaluatePage((type: string) => {
				const selectors = [
					`button[aria-label*='${type}']`,
					`button[aria-label*='${type.toUpperCase()}']`,
					`span[aria-label*='${type}']`,
					`span[aria-label*='${type.toUpperCase()}']`,
					".x1i10hfl",
					".x193iq5w",
				];

				for (const selector of selectors) {
					const element = document.querySelector(selector);
					if (element) {
						const ariaLabel =
							element.getAttribute("aria-label") || element.textContent;
						if (ariaLabel) {
							const matches = ariaLabel.match(/(\d+(?:,\d+)*)/);
							if (matches) {
								return parseInt(matches[1].replace(/,/g, ""), 10);
							}
						}
					}
				}

				return 0;
			}, type);
		} catch (error) {
			return 0;
		}
	}

	/**
	 * Fallback extraction method
	 */
	private async fallbackExtraction(
		page: any,
		url: string,
		log: any,
	): Promise<ExtractedData> {
		log.info("Using Instagram fallback extraction method...");

		const contentId = this.extractContentId(url);
		const metadata = await this.extractMetadata(page);

		return {
			...metadata,
			videoUrls: [],
			imageUrls: [],
			platformSpecific: {
				source: "fallback",
				contentId,
			},
		};
	}

	/**
	 * Enhanced platform-specific authentication for Instagram
	 */
	protected async applyPlatformAuthentication(
		page: any,
		log: any,
	): Promise<void> {
		if (!this.authConfig) return;

		try {
			log.info("Applying Instagram-specific authentication...");

			// Set Instagram-specific cookies if provided
			if (this.authConfig.cookies) {
				await page.setCookie(...this.authConfig.cookies);
			}

			// Apply Instagram-specific headers
			const instagramHeaders = {
				Referer: "https://www.instagram.com/",
				Origin: "https://www.instagram.com",
				"Sec-Fetch-Dest": "empty",
				"Sec-Fetch-Mode": "cors",
				"Sec-Fetch-Site": "same-origin",
				"X-CSRFToken": this.generateCSRFToken(),
				"X-Instagram-AJAX": "1",
				...this.authConfig.headers,
			};

			await page.setExtraHTTPHeaders(instagramHeaders);
			log.info("Instagram authentication applied successfully");
		} catch (error) {
			log.warning("Failed to apply Instagram authentication:", error);
		}
	}

	/**
	 * Generate CSRF token for Instagram
	 */
	private generateCSRFToken(): string {
		return (
			Math.random().toString(36).substring(2, 16) +
			Math.random().toString(36).substring(2, 16)
		);
	}

	/**
	 * Enhanced wait for dynamic content specific to Instagram
	 */
	protected async waitForDynamicContent(page: any, log: any): Promise<void> {
		const indicators = [
			"article",
			"video[src]",
			"img[src*='instagram']",
			"[data-loaded='true']",
			".x1i10hfl",
			"[role='button']",
		];

		let foundIndicator = false;
		for (const indicator of indicators) {
			try {
				await page.waitForSelector(indicator, { timeout: 8000 });
				log.info(`Instagram content indicator found: ${indicator}`);
				foundIndicator = true;
				break; // Found one indicator, no need to check others
			} catch (error) {
				// Continue to next indicator
			}
		}

		if (!foundIndicator) {
			// If no indicators found, wait a bit longer for potential content loading
			await page.waitForTimeout(5000);
			log.info("No specific Instagram indicators found, using default wait");
		}
	}

	/**
	 * Enhanced file size estimation for Instagram content
	 */
	protected estimateFileSize(data: ExtractedData): string {
		const duration = data.metadata?.duration || 30;
		const isVideo = data.videoUrls.length > 0;
		const isCarousel = data.metadata?.isCarousel || false;

		if (isVideo) {
			// Instagram videos are typically optimized for mobile
			const baseSizePerSecond = 0.15; // MB per second
			const estimatedSize = duration * baseSizePerSecond;
			return `${estimatedSize.toFixed(1)} MB`;
		} else {
			// Instagram images
			const baseSize = isCarousel ? 2.0 : 1.5; // MB
			const variation = Math.random() * 1.0; // ±1MB variation
			return `${(baseSize + variation).toFixed(1)} MB`;
		}
	}

	/**
	 * Enhanced quality detection for Instagram content
	 */
	protected determineQuality(url: string): "hd" | "sd" | "unknown" {
		const lowerUrl = url.toLowerCase();

		// Instagram-specific quality indicators
		if (
			lowerUrl.includes("1080") ||
			lowerUrl.includes("720") ||
			lowerUrl.includes("hd") ||
			lowerUrl.includes("high")
		) {
			return "hd";
		}

		if (
			lowerUrl.includes("480") ||
			lowerUrl.includes("360") ||
			lowerUrl.includes("sd") ||
			lowerUrl.includes("low")
		) {
			return "sd";
		}

		return "unknown";
	}
}
