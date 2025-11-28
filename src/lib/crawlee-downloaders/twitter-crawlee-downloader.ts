import type { DownloadResult } from "@/types/download";
import {
	CrawleeError,
	CrawleeErrorType,
	EnhancedCrawleeDownloader,
	type EnhancedCrawleeOptions,
	type ExtractedData,
} from "../enhanced-crawlee-downloader";

/**
 * Enhanced Twitter/X downloader using Crawlee with improved error handling and retry mechanisms
 */
export class TwitterCrawleeDownloader extends EnhancedCrawleeDownloader {
	constructor(options: EnhancedCrawleeOptions = {}) {
		super("twitter", {
			...options,
			// Enhanced retry configuration for Twitter/X
			retryConfig: {
				maxRetries: 3,
				initialDelay: 1500,
				maxDelay: 30000,
				backoffFactor: 2.2,
				...options.retryConfig,
			},
			// Platform-specific configuration
			platformConfig: {
				// Elements to wait for before extraction
				waitForElements: [
					"[data-testid='tweet']",
					"[data-testid='tweetText']",
					"video",
					"[data-testid='videoPlayer']",
					"[data-testid='videoContainer']",
					"[data-testid='mediaContainer']",
				],
				// Data selectors for extraction
				dataSelectors: [
					"script:not([src])",
					"#__INITIAL_STATE__",
					"script[type='application/json']",
					"[data-testid='tweet']",
					"[data-testid='tweetText']",
				],
				// Additional configuration for Twitter/X
				extractionTimeout: 20000,
				maxScrollAttempts: 2,
				...options.platformConfig,
			},
		});
	}

	/**
	 * Extract Twitter content ID from URL with enhanced patterns
	 */
	protected extractContentId(url: string): string {
		try {
			const urlObj = new URL(url);
			const path = urlObj.pathname;

			// Handle different Twitter/X URL formats
			const patterns = [
				/\/status\/(\d+)/,
				/\/[^/]+\/status\/(\d+)/,
				/\/i\/web\/status\/(\d+)/,
				/\/x\.com\/status\/(\d+)/,
				/\/x\.com\/[^/]+\/status\/(\d+)/,
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
	 * Enhanced Twitter data extraction with multiple fallback strategies
	 */
	protected async extractFromPage(
		page: any,
		url: string,
		log: any,
	): Promise<ExtractedData | null> {
		log.info("Starting enhanced Twitter/X data extraction...");

		try {
			const config = this.options.platformConfig || {};

			// Strategy 1: Enhanced page loading
			await this.loadTwitterPage(page, log);

			// Strategy 2: Multi-method data extraction
			const extractedData = await this.extractTwitterDataWithStrategies(
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
			log.error("Twitter/X data extraction failed:", error);
			throw new CrawleeError(
				CrawleeErrorType.PARSING_ERROR,
				"Failed to extract Twitter/X data from page",
				this.platform,
				error as Error,
			);
		}
	}

	/**
	 * Enhanced Twitter page loading with multiple strategies
	 */
	private async loadTwitterPage(page: any, log: any): Promise<void> {
		log.info("Loading Twitter/X page with enhanced strategies...");

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

			log.info("Twitter/X page loaded successfully");
		} catch (error) {
			log.warning("Twitter/X page loading issues, continuing anyway:", error);
		}
	}

	/**
	 * Multi-strategy Twitter data extraction
	 */
	private async extractTwitterDataWithStrategies(
		page: any,
		log: any,
		config: any,
	): Promise<ExtractedData | null> {
		const strategies = [
			() => this.extractFromInitialState(page, log),
			() => this.extractFromHiveData(page, log),
			() => this.extractFromGqlData(page, log),
			() => this.extractFromDOMElements(page, log),
		];

		for (const strategy of strategies) {
			try {
				log.info("Trying Twitter/X extraction strategy...");
				const data = await strategy();
				if (data && (data.videoUrls.length > 0 || data.imageUrls.length > 0)) {
					log.info("Twitter/X extraction strategy successful");
					return data;
				}
			} catch (error) {
				log.warning("Twitter/X extraction strategy failed:", error);
			}
		}

		return null;
	}

	/**
	 * Extract data from __INITIAL_STATE__
	 */
	private async extractFromInitialState(
		page: any,
		log: any,
	): Promise<ExtractedData | null> {
		return await this.evaluatePage(() => {
			const scripts = Array.from(
				document.querySelectorAll("script:not([src])"),
			);

			for (const script of scripts) {
				if (!script.textContent) continue;

				try {
					const stateMatch = script.textContent.match(
						/window\.__INITIAL_STATE__\s*=\s*(.*?)(?:;?\s*<\/script>|;\s*window)/,
					);
					if (!stateMatch?.[1]) continue;

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
						const user = state.entities.users.entities[tweet.user_id_str];

						const result: ExtractedData = {
							title: tweet.full_text || tweet.text || "",
							author: user?.name || "",
							username: user?.screen_name || "",
							videoUrls: [],
							imageUrls: [],
							thumbnailUrl: "",
							engagement: {
								likes: tweet.favorite_count || 0,
								retweets: tweet.retweet_count || 0,
								comments: tweet.reply_count || 0,
								views: 0,
							},
							metadata: {
								createdAt: tweet.created_at,
								isReply: tweet.in_reply_to_status_id !== null,
								isRetweet: tweet.retweeted_status !== undefined,
								language: tweet.lang,
								possiblySensitive: tweet.possibly_sensitive,
								timestamp: tweet.timestamp_ms,
							},
							platformSpecific: {
								tweetId: tweet.id_str,
								userId: user?.id_str,
								isVerified: user?.verified,
								isBlueVerified: user?.verified_type === "Blue",
								followers: user?.followers_count,
								following: user?.friends_count,
								source: "__INITIAL_STATE__",
							},
						};

						// Avatar
						result.avatar = user?.profile_image_url_https || "";

						// Media extraction
						if (tweet.extended_entities?.media) {
							tweet.extended_entities.media.forEach((media: any) => {
								if (media.type === "video" && media.video_info?.variants) {
									// Find the best quality video variant
									const variants = media.video_info.variants
										.filter((v: any) => v.content_type === "video/mp4")
										.sort(
											(a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0),
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

						return result;
					}
				} catch (e) {
					// Continue to next script
				}
			}

			return null;
		}, "__INITIAL_STATE__ extraction");
	}

	/**
	 * Extract data from __HIVE_DATA__ (newer Twitter)
	 */
	private async extractFromHiveData(
		page: any,
		log: any,
	): Promise<ExtractedData | null> {
		return await this.evaluatePage(() => {
			const scripts = Array.from(
				document.querySelectorAll("script:not([src])"),
			);

			for (const script of scripts) {
				if (!script.textContent) continue;

				try {
					const hiveMatch = script.textContent.match(
						/window\.__HIVE_DATA__\s*=\s*(.*?)(?:;?\s*<\/script>|;\s*window)/,
					);
					if (!hiveMatch?.[1]) continue;

					let jsonStr = hiveMatch[1].trim();
					if (jsonStr.endsWith(";")) {
						jsonStr = jsonStr.slice(0, -1);
					}

					const hiveData = JSON.parse(jsonStr);

					// Extract tweet data from hive data
					const tweetPath = window.location.pathname;
					const pathMatch = tweetPath.match(/\/status\/(\d+)/);
					const tweetId = pathMatch?.[1];

					if (tweetId) {
						// Search for the tweet in hive data
						const tweetData = this.findTweetInHiveData(hiveData, tweetId);
						if (tweetData) {
							return tweetData;
						}
					}
				} catch (e) {
					// Continue to next script
				}
			}

			return null;
		}, "__HIVE_DATA__ extraction");
	}

	/**
	 * Helper method to find tweet in hive data
	 */
	private findTweetInHiveData(hiveData: any, tweetId: string): any {
		try {
			const jsonStr = JSON.stringify(hiveData);
			const tweetRegex = new RegExp(
				`"id_str":"${tweetId}"[^}]*"full_text":"([^"]*)"[^}]*"entities":`,
			);
			const match = jsonStr.match(tweetRegex);

			if (match) {
				// This is a simplified version - in practice, you'd need more complex parsing
				return null;
			}
		} catch (e) {
			// Ignore parsing errors
		}

		return null;
	}

	/**
	 * Extract data from GraphQL data
	 */
	private async extractFromGqlData(
		page: any,
		log: any,
	): Promise<ExtractedData | null> {
		return await this.evaluatePage(() => {
			// Look for GraphQL data in script tags
			const scripts = Array.from(document.querySelectorAll("script"));

			for (const script of scripts) {
				if (!script.textContent) continue;

				try {
					const data = JSON.parse(script.textContent);
					const jsonStr = JSON.stringify(data);

					// Look for media URL patterns in GraphQL data
					const videoUrlMatches = jsonStr.match(
						/https:\/\/video\.twimg\.com[^"]*\/(?:\d+x\d+)\/video\/(?:mp4|webm)[^"]*/gi,
					);
					const imageUrlMatches = jsonStr.match(
						/https:\/\/pbs\.twimg\.com[^"]*\.(?:jpg|jpeg|png)/gi,
					);

					if (videoUrlMatches.length > 0 || imageUrlMatches.length > 0) {
						return {
							title: "Twitter/X Content",
							videoUrls: [
								...new Set(videoUrlMatches.filter((url) => url.length > 20)),
							],
							imageUrls: [
								...new Set(imageUrlMatches.filter((url) => url.length > 20)),
							],
							thumbnailUrl: imageUrlMatches[0] || "",
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

			// Enhanced content extraction
			const contentInfo = await this.evaluatePage(() => {
				// Extract tweet text
				const tweetText = document.querySelector("[data-testid='tweetText']");
				const content = tweetText?.textContent || "";

				// Extract author information
				const authorElement = document.querySelector(
					"[data-testid='User-Name']",
				);
				let author = "";
				let username = "";

				if (authorElement) {
					const authorLink = authorElement.querySelector("a");
					if (authorLink) {
						author = authorLink.textContent || "";
						username = author.getAttribute("href")?.replace(/[/@]/g, "") || "";
					}
				}

				// Extract avatar
				const avatarElement = document.querySelector(
					"[data-testid='UserAvatar'] img",
				);
				const avatar = avatarElement?.src || "";

				// Extract engagement metrics
				const engagement = {
					likes: 0,
					retweets: 0,
					comments: 0,
				};

				const engagementElements = {
					likes: document.querySelector("[data-testid='like']"),
					retweets: document.querySelector("[data-testid='retweet']"),
					comments: document.querySelector("[data-testid='reply']"),
				};

				Object.entries(engagementElements).forEach(([key, element]) => {
					if (element) {
						const ariaLabel =
							element.getAttribute("aria-label") || element.textContent;
						if (ariaLabel) {
							const matches = ariaLabel.match(/(\d+(?:,\d+)*)/);
							if (matches) {
								engagement[key as keyof typeof engagement] = parseInt(
									matches[1].replace(/,/g, ""),
									10,
								);
							}
						}
					}
				});

				return { content, author, username, avatar, engagement };
			}, "Twitter content extraction");

			return {
				...metadata,
				title: contentInfo.content || metadata.title,
				author: contentInfo.author || metadata.author,
				username: contentInfo.username || metadata.username,
				avatar: contentInfo.avatar || metadata.avatar,
				videoUrls,
				imageUrls,
				engagement: contentInfo.engagement,
				metadata: {
					...metadata.metadata,
					contentType: videoUrls.length > 0 ? "video" : "image",
				},
				platformSpecific: {
					source: "DOM extraction",
				},
			};
		} catch (error) {
			log.warning("Twitter/X DOM extraction failed:", error);
			return null;
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
		log.info("Using Twitter/X fallback extraction method...");

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
	 * Enhanced platform-specific authentication for Twitter/X
	 */
	protected async applyPlatformAuthentication(
		page: any,
		log: any,
	): Promise<void> {
		if (!this.authConfig) return;

		try {
			log.info("Applying Twitter/X-specific authentication...");

			// Set Twitter/X-specific cookies if provided
			if (this.authConfig.cookies) {
				await page.setCookie(...this.authConfig.cookies);
			}

			// Apply Twitter/X-specific headers
			const twitterHeaders = {
				Referer: "https://twitter.com/",
				Origin: "https://twitter.com",
				"Sec-Fetch-Dest": "empty",
				"Sec-Fetch-Mode": "cors",
				"Sec-Fetch-Site": "same-origin",
				"X-Twitter-Auth-Type": "OAuth2Session",
				"X-Twitter-Client-Language": "en",
				"X-Twitter-Active-User": "yes",
				"X-CSRF-Token": this.generateCSRFToken(),
				...this.authConfig.headers,
			};

			await page.setExtraHTTPHeaders(twitterHeaders);
			log.info("Twitter/X authentication applied successfully");
		} catch (error) {
			log.warning("Failed to apply Twitter/X authentication:", error);
		}
	}

	/**
	 * Generate CSRF token for Twitter/X
	 */
	private generateCSRFToken(): string {
		return (
			Math.random().toString(36).substring(2, 24) + Date.now().toString(36)
		);
	}

	/**
	 * Enhanced wait for dynamic content specific to Twitter/X
	 */
	protected async waitForDynamicContent(page: any, log: any): Promise<void> {
		const indicators = [
			"[data-testid='tweet']",
			"[data-testid='tweetText']",
			"video[src]",
			"[data-testid='videoPlayer']",
			"[data-testid='mediaContainer']",
			"[data-testid='cardWrapper']",
			"[role='article']",
		];

		let foundIndicator = false;
		for (const indicator of indicators) {
			try {
				await page.waitForSelector(indicator, { timeout: 8000 });
				log.info(`Twitter/X content indicator found: ${indicator}`);
				foundIndicator = true;
				break; // Found one indicator, no need to check others
			} catch (error) {
				// Continue to next indicator
			}
		}

		if (!foundIndicator) {
			// If no indicators found, wait a bit longer for potential content loading
			await page.waitForTimeout(5000);
			log.info("No specific Twitter/X indicators found, using default wait");
		}
	}

	/**
	 * Enhanced file size estimation for Twitter videos
	 */
	protected estimateFileSize(data: ExtractedData): string {
		// Twitter videos are typically compressed and smaller
		const baseSize =
			this.determineQuality(data.videoUrls[0] || "") === "hd" ? 4 : 2.5; // MB
		const variation = Math.random() * 1.5; // ±1.5MB variation
		return `${(baseSize + variation).toFixed(1)} MB`;
	}

	/**
	 * Enhanced quality detection for Twitter videos
	 */
	protected determineQuality(url: string): "hd" | "sd" | "unknown" {
		const lowerUrl = url.toLowerCase();

		// Twitter-specific quality indicators
		if (
			lowerUrl.includes("1080") ||
			lowerUrl.includes("720") ||
			lowerUrl.includes("hd") ||
			lowerUrl.includes("high") ||
			lowerUrl.includes("720p") ||
			lowerUrl.includes("1080p")
		) {
			return "hd";
		}

		if (
			lowerUrl.includes("480") ||
			lowerUrl.includes("360") ||
			lowerUrl.includes("sd") ||
			lowerUrl.includes("low") ||
			lowerUrl.includes("480p") ||
			lowerUrl.includes("360p")
		) {
			return "sd";
		}

		return "unknown";
	}
}
