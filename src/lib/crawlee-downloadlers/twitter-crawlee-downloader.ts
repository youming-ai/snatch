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
				initialDelay: 2000,
				maxDelay: 35000,
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
					"[data-testid='primaryColumn']",
					"[role='article']",
				],
				// Data selectors for extraction
				dataSelectors: [
					"script:not([src])",
					"script[type='application/json']",
					"[data-testid='tweet']",
					"[data-testid='primaryColumn']",
				],
				// Additional configuration for Twitter/X
				extractionTimeout: 18000,
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
				/\/status\/(\d+)/i,
				/\/[^/]+\/status\/(\d+)/i,
				/\/web\/status\/(\d+)/i, // Twitter web status
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
				"Failed to extract Twitter data from page",
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
						window.scrollTo(0, document.body.scrollHeight / 3);
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
			() => this.extractFromGqlData(page, log),
			() => this.extractFromDOMElements(page, log),
			() => this.extractFromFeatureFlags(page, log),
		];

		for (const strategy of strategies) {
			try {
				log.info("Trying Twitter extraction strategy...");
				const data = await strategy();
				if (data && (data.videoUrls.length > 0 || data.imageUrls.length > 0)) {
					log.info("Twitter extraction strategy successful");
					return data;
				}
			} catch (error) {
				log.warning("Twitter extraction strategy failed:", error);
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
			const scripts = document.querySelectorAll("script:not([src])");

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

					if (!tweetId || !state.entities?.tweets?.entities?.[tweetId])
						continue;

					const tweet = state.entities.tweets.entities[tweetId];
					const user = state.entities.users?.entities?.[tweet.user_id_str];

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
							views: tweet.view_count || 0,
						},
						metadata: {
							createdAt: tweet.created_at,
							isRetweet: !!tweet.retweeted_status,
							isQuote: !!tweet.is_quote_status,
							lang: tweet.lang,
							source: tweet.source,
							possiblySensitive: tweet.possibly_sensitive,
						},
						platformSpecific: {
							itemId: tweet.id_str,
							userId: user?.id_str,
							screenName: user?.screen_name,
							source: "__INITIAL_STATE__",
						},
					};

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
							} else if (media.type === "animated_gif") {
								// Handle GIFs as videos
								if (media.video_info?.variants?.length > 0) {
									result.videoUrls.push(media.video_info.variants[0].url);
								}
							}
						});
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
				} catch (e) {
					console.warn("Failed to parse __INITIAL_STATE__:", e);
				}
			}

			return null;
		}, "__INITIAL_STATE__ extraction");
	}

	/**
	 * Extract data from GraphQL data (newer Twitter)
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

					// Look for Twitter-specific media URL patterns
					const videoUrlMatches = jsonStr.match(
						/https:\/\/[^"\s]+twimg\.com[^"\s]*\.(?:mp4|mov|webm)(?:\?[^"\s]*)?/gi,
					);
					const imageUrlMatches = jsonStr.match(
						/https:\/\/[^"\s]+twimg\.com[^"\s]*\.(?:jpg|jpeg|png|gif)(?:\?[^"\s]*)?/gi,
					);

					if (videoUrlMatches.length > 0 || imageUrlMatches.length > 0) {
						// Extract basic metadata from page
						const title = document.querySelector("title")?.textContent || "";
						const tweetText =
							document.querySelector("[data-testid='tweetText']")
								?.textContent || "";

						return {
							title: tweetText || title || "Twitter Post",
							videoUrls: [...new Set(videoUrlMatches)],
							imageUrls: [...new Set(imageUrlMatches)],
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

			// Enhanced content and author extraction
			const contentInfo = await this.evaluatePage(() => {
				// Extract tweet text
				const tweetTextElement = document.querySelector(
					"[data-testid='tweetText']",
				);
				const content = tweetTextElement?.textContent?.trim() || "";

				// Extract author information
				const authorElement = document.querySelector(
					"[data-testid='User-Name']",
				);
				let author = "";
				let username = "";

				if (authorElement) {
					const authorNameElement = authorElement.querySelector("a span");
					const usernameElement = authorElement.querySelector(
						"a[href*='/'] span:last-child",
					);

					author = authorNameElement?.textContent?.trim() || "";
					username =
						usernameElement?.textContent?.replace("@", "")?.trim() || "";
				}

				return { content, author, username };
			}, "Twitter content extraction");

			return {
				...metadata,
				title: contentInfo.content || metadata.title,
				author: contentInfo.author || metadata.author,
				username: contentInfo.username || metadata.username,
				videoUrls,
				imageUrls,
				engagement: await this.extractTwitterEngagement(page),
				metadata: {
					...metadata.metadata,
					contentType: videoUrls.length > 0 ? "video" : "image",
					isGif: videoUrls.some((url) => url.includes("tweet_video_thumb")),
				},
				platformSpecific: {
					source: "DOM extraction",
				},
			};
		} catch (error) {
			log.warning("Twitter DOM extraction failed:", error);
			return null;
		}
	}

	/**
	 * Extract data from feature flags and modern Twitter data structures
	 */
	private async extractFromFeatureFlags(
		page: any,
		log: any,
	): Promise<ExtractedData | null> {
		return await this.evaluatePage(() => {
			// Look for modern Twitter data structures
			const twitterData = (window as any).__twttr || (window as any).TWTR;

			if (twitterData) {
				try {
					const jsonStr = JSON.stringify(twitterData);
					const videoUrlMatches = jsonStr.match(
						/https:\/\/[^"\s]+twimg\.com[^"\s]*\.(?:mp4|mov|webm)(?:\?[^"\s]*)?/gi,
					);
					const imageUrlMatches = jsonStr.match(
						/https:\/\/[^"\s]+twimg\.com[^"\s]*\.(?:jpg|jpeg|png|gif)(?:\?[^"\s]*)?/gi,
					);

					if (videoUrlMatches.length > 0 || imageUrlMatches.length > 0) {
						const title = document.querySelector("title")?.textContent || "";

						return {
							title: title || "Twitter Post",
							videoUrls: [...new Set(videoUrlMatches)],
							imageUrls: [...new Set(imageUrlMatches)],
							thumbnailUrl: imageUrlMatches[0] || "",
							platformSpecific: {
								source: "Feature flags extraction",
							},
						} as ExtractedData;
					}
				} catch (e) {
					console.warn("Failed to parse Twitter feature flags:", e);
				}
			}

			return null;
		}, "Feature flags extraction");
	}

	/**
	 * Extract Twitter engagement metrics
	 */
	private async extractTwitterEngagement(page: any): Promise<{
		likes: number;
		retweets: number;
		comments: number;
		views: number;
	}> {
		try {
			return await this.evaluatePage(() => {
				const engagement = {
					likes: 0,
					retweets: 0,
					comments: 0,
					views: 0,
				};

				// Extract likes
				const likeSelectors = [
					"[data-testid='like']",
					"[data-testid='unlike']",
					"button[aria-label*='like']",
					"button[aria-label*='Like']",
				];

				for (const selector of likeSelectors) {
					const element = document.querySelector(selector);
					if (element) {
						const ariaLabel = element.getAttribute("aria-label");
						if (ariaLabel) {
							const matches = ariaLabel.match(/(\d+(?:,\d+)*)/);
							if (matches) {
								engagement.likes = parseInt(matches[1].replace(/,/g, ""), 10);
								break;
							}
						}
					}
				}

				// Extract retweets
				const retweetSelectors = [
					"[data-testid='retweet']",
					"[data-testid='unretweet']",
					"button[aria-label*='retweet']",
					"button[aria-label*='Retweet']",
				];

				for (const selector of retweetSelectors) {
					const element = document.querySelector(selector);
					if (element) {
						const ariaLabel = element.getAttribute("aria-label");
						if (ariaLabel) {
							const matches = ariaLabel.match(/(\d+(?:,\d+)*)/);
							if (matches) {
								engagement.retweets = parseInt(
									matches[1].replace(/,/g, ""),
									10,
								);
								break;
							}
						}
					}
				}

				// Extract comments
				const commentSelectors = [
					"[data-testid='reply']",
					"button[aria-label*='reply']",
					"button[aria-label*='Reply']",
				];

				for (const selector of commentSelectors) {
					const element = document.querySelector(selector);
					if (element) {
						const ariaLabel = element.getAttribute("aria-label");
						if (ariaLabel) {
							const matches = ariaLabel.match(/(\d+(?:,\d+)*)/);
							if (matches) {
								engagement.comments = parseInt(
									matches[1].replace(/,/g, ""),
									10,
								);
								break;
							}
						}
					}
				}

				// Extract views (if available)
				const viewSelectors = [
					"[aria-label*='view']",
					"[aria-label*='View']",
					".r-1kbdv8c", // Twitter's view count class
				];

				for (const selector of viewSelectors) {
					const element = document.querySelector(selector);
					if (element) {
						const text =
							element.getAttribute("aria-label") || element.textContent;
						if (text) {
							const matches = text.match(/(\d+(?:,\d+)*)/);
							if (matches) {
								engagement.views = parseInt(matches[1].replace(/,/g, ""), 10);
								break;
							}
						}
					}
				}

				return engagement;
			});
		} catch (error) {
			return { likes: 0, retweets: 0, comments: 0, views: 0 };
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
		log.info("Using Twitter fallback extraction method...");

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

			// Set Twitter-specific cookies if provided
			if (this.authConfig.cookies) {
				await page.setCookie(...this.authConfig.cookies);
			}

			// Apply Twitter-specific headers
			const twitterHeaders = {
				Referer: "https://twitter.com/",
				Origin: "https://twitter.com",
				"Sec-Fetch-Dest": "empty",
				"Sec-Fetch-Mode": "cors",
				"Sec-Fetch-Site": "same-origin",
				Authorization: this.authConfig.apiTokens?.bearer || "",
				"X-Twitter-Client-Version": this.generateClientVersion(),
				"X-Twitter-Active-User": "yes",
				...this.authConfig.headers,
			};

			await page.setExtraHTTPHeaders(twitterHeaders);
			log.info("Twitter/X authentication applied successfully");
		} catch (error) {
			log.warning("Failed to apply Twitter/X authentication:", error);
		}
	}

	/**
	 * Generate Twitter client version
	 */
	private generateClientVersion(): string {
		return "TwitterWebApp";
	}

	/**
	 * Enhanced wait for dynamic content specific to Twitter/X
	 */
	protected async waitForDynamicContent(page: any, log: any): Promise<void> {
		const indicators = [
			"[data-testid='tweet']",
			"[data-testid='tweetText']",
			"video[src]",
			"[data-testid='primaryColumn']",
			"[role='article']",
			"[data-loaded='true']",
		];

		let foundIndicator = false;
		for (const indicator of indicators) {
			try {
				await page.waitForSelector(indicator, { timeout: 8000 });
				log.info(`Twitter content indicator found: ${indicator}`);
				foundIndicator = true;
				break; // Found one indicator, no need to check others
			} catch (error) {
				// Continue to next indicator
			}
		}

		if (!foundIndicator) {
			// If no indicators found, wait a bit longer for potential content loading
			await page.waitForTimeout(5000);
			log.info("No specific Twitter indicators found, using default wait");
		}
	}

	/**
	 * Enhanced file size estimation for Twitter content
	 */
	protected estimateFileSize(data: ExtractedData): string {
		const isVideo = data.videoUrls.length > 0;
		const isGif = data.metadata?.isGif || false;

		if (isGif) {
			// Twitter GIFs are typically small
			return `${(Math.random() * 3 + 1).toFixed(1)} MB`;
		} else if (isVideo) {
			// Twitter videos are typically optimized for web
			const duration = data.metadata?.duration || 30;
			const baseSizePerSecond = 0.12; // MB per second
			const estimatedSize = duration * baseSizePerSecond;
			return `${estimatedSize.toFixed(1)} MB`;
		} else {
			// Twitter images
			const baseSize = 0.8; // MB
			const variation = Math.random() * 0.6; // ±0.6MB variation
			return `${(baseSize + variation).toFixed(1)} MB`;
		}
	}

	/**
	 * Enhanced quality detection for Twitter content
	 */
	protected determineQuality(url: string): "hd" | "sd" | "unknown" {
		const lowerUrl = url.toLowerCase();

		// Twitter-specific quality indicators
		if (
			lowerUrl.includes("720") ||
			lowerUrl.includes("1080") ||
			lowerUrl.includes("hd") ||
			lowerUrl.includes("high") ||
			lowerUrl.includes("ext_tw_video")
		) {
			return "hd";
		}

		if (
			lowerUrl.includes("480") ||
			lowerUrl.includes("360") ||
			lowerUrl.includes("sd") ||
			lowerUrl.includes("low") ||
			lowerUrl.includes("tweet_video_thumb")
		) {
			return "sd";
		}

		return "unknown";
	}
}
