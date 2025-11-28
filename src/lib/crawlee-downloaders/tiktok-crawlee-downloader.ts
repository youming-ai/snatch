import type { DownloadResult } from "@/types/download";
import {
	CrawleeError,
	CrawleeErrorType,
	EnhancedCrawleeDownloader,
	type EnhancedCrawleeOptions,
	type ExtractedData,
} from "../enhanced-crawlee-downloader";

/**
 * Enhanced TikTok downloader using Crawlee with improved error handling, retry mechanisms, and multiple extraction strategies
 */
export class TikTokCrawleeDownloader extends EnhancedCrawleeDownloader {
	constructor(options: EnhancedCrawleeOptions = {}) {
		super("tiktok", {
			...options,
			// Enhanced retry configuration for TikTok
			retryConfig: {
				maxRetries: 4,
				initialDelay: 2000,
				maxDelay: 45000,
				backoffFactor: 2.5,
				...options.retryConfig,
			},
			// Platform-specific configuration
			platformConfig: {
				// Elements to wait for before extraction
				waitForElements: [
					"[data-e2e='video-player']",
					"video",
					"[data-e2e='browse-video-desc']",
					"[data-e2e='video-card']",
					".xgplayer-video",
					"[data-e2e='recommend-list-container']",
					".tiktok-web-player",
				],
				// Data selectors for extraction
				dataSelectors: [
					"#__UNIVERSAL_DATA_FOR_REHYDRATION__",
					"#SIGI_STATE",
					"script[type='application/json']",
					"[data-e2e='user-title']",
					"[data-e2e='browse-video-desc']",
				],
				// Additional configuration for TikTok
				extractionTimeout: 15000,
				maxScrollAttempts: 3,
				...options.platformConfig,
			},
		});
	}

	/**
	 * Extract TikTok content ID from URL with enhanced patterns
	 */
	protected extractContentId(url: string): string {
		try {
			const urlObj = new URL(url);
			const path = urlObj.pathname;

			// Handle different TikTok URL formats
			const patterns = [
				// Standard video URLs
				/tiktok\.com\/@[^/]+\/video\/(\d+)/i,
				/tiktok\.com\/video\/(\d+)/i,
				// Shortened URLs
				/vt\.tiktok\.com\/([A-Za-z0-9_-]+)/i,
				/tiktok\.com\/t\/([A-Za-z0-9_-]+)/i,
				// Mobile URLs
				/m\.tiktok\.com\/v\/(\d+)/i,
			];

			for (const pattern of patterns) {
				const match = path.match(pattern);
				if (match) return match[1];
			}

			// Handle @username/video format
			const userVideoMatch = path.match(/\/@([^/]+)\/video\/(\d+)/);
			if (userVideoMatch) return userVideoMatch[2];

			// Generate fallback ID from URL hash
			return Buffer.from(url).toString("base64").substring(0, 16);
		} catch {
			return "unknown";
		}
	}

	/**
	 * Enhanced TikTok data extraction with multiple fallback strategies
	 */
	protected async extractFromPage(
		page: any,
		url: string,
		log: any,
	): Promise<ExtractedData | null> {
		log.info("Starting enhanced TikTok data extraction...");

		try {
			const config = this.options.platformConfig || {};

			// Strategy 1: Enhanced page loading
			await this.loadTikTokPage(page, log);

			// Strategy 2: Multi-method data extraction
			const extractedData = await this.extractTikTokDataWithStrategies(
				page,
				log,
				config,
			);

			// Strategy 3: Fallback extraction if main strategies fail
			if (!extractedData || extractedData.videoUrls.length === 0) {
				log.warning("Main extraction strategies failed, trying fallback...");
				return await this.fallbackExtraction(page, url, log);
			}

			return extractedData;
		} catch (error) {
			log.error("TikTok data extraction failed:", error);
			throw new CrawleeError(
				CrawleeErrorType.PARSING_ERROR,
				"Failed to extract TikTok data from page",
				this.platform,
				error as Error,
			);
		}
	}

	/**
	 * Enhanced TikTok page loading with multiple strategies
	 */
	private async loadTikTokPage(page: any, log: any): Promise<void> {
		log.info("Loading TikTok page with enhanced strategies...");

		try {
			// Wait for initial network idle
			await page.waitForLoadState("networkidle", { timeout: 20000 });

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

			log.info("TikTok page loaded successfully");
		} catch (error) {
			log.warning("TikTok page loading issues, continuing anyway:", error);
		}
	}

	/**
	 * Multi-strategy TikTok data extraction
	 */
	private async extractTikTokDataWithStrategies(
		page: any,
		log: any,
		config: any,
	): Promise<ExtractedData | null> {
		const strategies = [
			() => this.extractFromUniversalData(page, log),
			() => this.extractFromSigiState(page, log),
			() => this.extractFromDOMElements(page, log),
			() => this.extractFromNetworkRequests(page, log),
		];

		for (const strategy of strategies) {
			try {
				log.info("Trying extraction strategy...");
				const data = await strategy();
				if (data && data.videoUrls.length > 0) {
					log.info("Extraction strategy successful");
					return data;
				}
			} catch (error) {
				log.warning("Extraction strategy failed:", error);
			}
		}

		return null;
	}

	/**
	 * Extract data from __UNIVERSAL_DATA_FOR_REHYDRATION__
	 */
	private async extractFromUniversalData(
		page: any,
		log: any,
	): Promise<ExtractedData | null> {
		return await this.evaluatePage(() => {
			const universalScript = document.getElementById(
				"__UNIVERSAL_DATA_FOR_REHYDRATION__",
			);
			if (!universalScript) return null;

			try {
				const universalData = JSON.parse(universalScript.textContent || "");
				const videoDetail =
					universalData?.__DEFAULT_SCOPE__?.["webapp.video-detail"];

				if (!videoDetail?.itemInfo?.itemStruct) return null;

				const item = videoDetail.itemInfo.itemStruct;
				const result: ExtractedData = {
					title: item.desc || "",
					author: item.author?.nickname || "",
					username: item.author?.uniqueId || "",
					videoUrls: [],
					imageUrls: [],
					thumbnailUrl: item.video?.cover || item.video?.shareCover || "",
					engagement: {
						likes: item.stats?.diggCount || 0,
						shares: item.stats?.shareCount || 0,
						comments: item.stats?.commentCount || 0,
						views: item.stats?.playCount || 0,
					},
					metadata: {
						duration: item.video?.duration || 0,
						createTime: item.createTime,
						musicTitle: item.music?.title,
						musicAuthor: item.music?.authorName,
						videoHeight: item.video?.height,
						videoWidth: item.video?.width,
					},
					platformSpecific: {
						itemId: item.id,
						authorId: item.author?.id,
						musicId: item.music?.id,
					},
				};

				// Extract video URLs with priority
				if (item.video?.downloadAddr?.length > 0) {
					result.videoUrls.push(
						...item.video.downloadAddr.map((addr: any) => addr.url),
					);
				}
				if (item.video?.playAddr) {
					result.videoUrls.push(item.video.playAddr);
				}

				// Remove duplicates and filter valid URLs
				result.videoUrls = [
					...new Set(
						result.videoUrls.filter(
							(url: string) =>
								url && url.startsWith("http") && !url.includes("blob:"),
						),
					),
				];

				return result;
			} catch (error) {
				console.warn(
					"Failed to parse __UNIVERSAL_DATA_FOR_REHYDRATION__:",
					error,
				);
				return null;
			}
		}, "__UNIVERSAL_DATA_FOR_REHYDRATION__ extraction");
	}

	/**
	 * Extract data from SIGI_STATE
	 */
	private async extractFromSigiState(
		page: any,
		log: any,
	): Promise<ExtractedData | null> {
		return await this.evaluatePage(() => {
			const sigiScript = document.getElementById("SIGI_STATE");
			if (!sigiScript) return null;

			try {
				const sigiData = JSON.parse(sigiScript.textContent || "");

				// Extract video ID from current URL
				const urlObj = new URL(window.location.href);
				const path = urlObj.pathname;
				const videoMatch = path.match(/\/video\/(\d+)/);
				const userVideoMatch = path.match(/\/@([^/]+)\/video\/(\d+)/);
				const videoId = videoMatch?.[1] || userVideoMatch?.[1];

				if (!videoId || !sigiData.ItemModule?.[videoId]) return null;

				const item = sigiData.ItemModule[videoId];
				const result: ExtractedData = {
					title: item.desc || "",
					author: item.author?.nickname || "",
					username: item.author?.uniqueId || "",
					videoUrls: [],
					imageUrls: [],
					thumbnailUrl: item.video?.cover || item.video?.shareCover || "",
					engagement: {
						likes: item.stats?.diggCount || 0,
						shares: item.stats?.shareCount || 0,
						comments: item.stats?.commentCount || 0,
						views: item.stats?.playCount || 0,
					},
					metadata: {
						duration: item.video?.duration || 0,
						createTime: item.createTime,
					},
					platformSpecific: {
						itemId: item.id,
						source: "SIGI_STATE",
					},
				};

				// Extract video URLs
				if (item.video?.downloadAddr?.length > 0) {
					result.videoUrls.push(
						...item.video.downloadAddr.map((addr: any) => addr.url),
					);
				}
				if (item.video?.playAddr) {
					result.videoUrls.push(item.video.playAddr);
				}

				result.videoUrls = [
					...new Set(
						result.videoUrls.filter(
							(url: string) => url && url.startsWith("http"),
						),
					),
				];

				return result;
			} catch (error) {
				console.warn("Failed to parse SIGI_STATE:", error);
				return null;
			}
		}, "SIGI_STATE extraction");
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

			// Enhanced title extraction
			const title = await this.evaluatePage(() => {
				const selectors = [
					"[data-e2e='browse-video-desc']",
					"[data-e2e='video-desc']",
					".tiktok-5iy4x2-DivDesc",
					".tiktok-1s2jvi-DivText",
					"[data-e2e='user-title']",
				];

				for (const selector of selectors) {
					const element = document.querySelector(selector);
					if (element?.textContent?.trim()) {
						return element.textContent.trim();
					}
				}

				return document.querySelector("title")?.textContent || "";
			}, "TikTok title extraction");

			// Enhanced author extraction
			const authorInfo = await this.evaluatePage(() => {
				const selectors = [
					"[data-e2e='video-creator']",
					"[data-e2e='user-title']",
					".tiktok-1qbic8-DivUserContainer",
					".tiktok-11u47i-DivAvatar",
				];

				for (const selector of selectors) {
					const element = document.querySelector(selector);
					if (element) {
						const username = element.getAttribute("href")?.replace(/[/@]/g, "");
						const name =
							element.querySelector('[data-e2e="user-title"]')?.textContent ||
							element.textContent?.trim() ||
							username;
						if (name && username) {
							return { name, username };
						}
					}
				}

				// Fallback: extract from URL
				const urlMatch = window.location.pathname.match(/\/@([^/]+)/);
				if (urlMatch) {
					return { name: `@${urlMatch[1]}`, username: urlMatch[1] };
				}

				return { name: "Unknown", username: "unknown" };
			}, "TikTok author extraction");

			return {
				...metadata,
				title: title || metadata.title,
				author: authorInfo?.name || metadata.author,
				username: authorInfo?.username || metadata.username,
				videoUrls,
				imageUrls,
				platformSpecific: {
					source: "DOM extraction",
				},
			};
		} catch (error) {
			log.warning("DOM extraction failed:", error);
			return null;
		}
	}

	/**
	 * Extract data from network requests (advanced method)
	 */
	private async extractFromNetworkRequests(
		page: any,
		log: any,
	): Promise<ExtractedData | null> {
		try {
			// Listen for network responses that might contain video URLs
			const networkData = await this.evaluatePage(() => {
				return new Promise((resolve) => {
					const videoUrls: string[] = [];

					// Override fetch to capture video URLs
					const originalFetch = window.fetch;
					window.fetch = function (...args: any[]) {
						const [url, options] = args;

						// Check if this is a video-related request
						if (typeof url === "string" && url.includes("video")) {
							// Try to extract video URLs from the response
							originalFetch
								.apply(this, args)
								.then((response) => {
									response
										.clone()
										.json()
										.then((data) => {
											const jsonStr = JSON.stringify(data);
											const urlMatches = jsonStr.match(
												/https?:\/\/[^\s"']+\.(?:mp4|mov|webm)/gi,
											);
											if (urlMatches) {
												videoUrls.push(...urlMatches);
											}
										})
										.catch(() => {});
								})
								.catch(() => {});
						}

						return originalFetch.apply(this, args);
					};

					// Return collected URLs after a delay
					setTimeout(
						() => resolve({ videoUrls: [...new Set(videoUrls)] }),
						5000,
					);
				});
			}, "Network request extraction");

			if (networkData && networkData.videoUrls.length > 0) {
				return {
					title: "TikTok Video",
					author: "Unknown",
					username: "unknown",
					videoUrls: networkData.videoUrls,
					imageUrls: [],
					thumbnailUrl: "",
					platformSpecific: {
						source: "Network requests",
					},
				};
			}

			return null;
		} catch (error) {
			log.warning("Network request extraction failed:", error);
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
		log.info("Using fallback extraction method...");

		const contentId = this.extractContentId(url);
		const metadata = await this.extractMetadata(page);

		return {
			...metadata,
			videoUrls: [], // Empty for fallback
			imageUrls: [],
			platformSpecific: {
				source: "fallback",
				contentId,
			},
		};
	}

	/**
	 * Enhanced platform-specific authentication for TikTok
	 */
	protected async applyPlatformAuthentication(
		page: any,
		log: any,
	): Promise<void> {
		if (!this.authConfig) return;

		try {
			log.info("Applying TikTok-specific authentication...");

			// Set TikTok-specific cookies if provided
			if (this.authConfig.cookies) {
				await page.setCookie(...this.authConfig.cookies);
			}

			// Apply TikTok-specific headers
			const tiktokHeaders = {
				Referer: "https://www.tiktok.com/",
				Origin: "https://www.tiktok.com",
				"Sec-Fetch-Dest": "empty",
				"Sec-Fetch-Mode": "cors",
				"Sec-Fetch-Site": "same-origin",
				"tt-webid": this.generateWebId(),
				...this.authConfig.headers,
			};

			await page.setExtraHTTPHeaders(tiktokHeaders);
			log.info("TikTok authentication applied successfully");
		} catch (error) {
			log.warning("Failed to apply TikTok authentication:", error);
		}
	}

	/**
	 * Generate TikTok web ID for authentication
	 */
	private generateWebId(): string {
		return Math.floor(Math.random() * 1000000000000000000).toString();
	}

	/**
	 * Enhanced wait for dynamic content specific to TikTok
	 */
	protected async waitForDynamicContent(page: any, log: any): Promise<void> {
		const indicators = [
			"[data-e2e='video-player']",
			"video[src]",
			".tiktok-web-player",
			"[data-e2e='browse-video-desc']",
			"[data-loaded='true']",
		];

		for (const indicator of indicators) {
			try {
				await page.waitForSelector(indicator, { timeout: 8000 });
				log.info(`TikTok content indicator found: ${indicator}`);
				return; // Found one indicator, no need to check others
			} catch (error) {
				// Continue to next indicator
			}
		}

		// If no indicators found, wait a bit longer for potential content loading
		await page.waitForTimeout(5000);
		log.info("No specific TikTok indicators found, using default wait");
	}

	/**
	 * Enhanced file size estimation for TikTok videos
	 */
	protected estimateFileSize(data: ExtractedData): string {
		const duration = data.metadata?.duration || 30;
		const quality = this.determineQuality(data.videoUrls[0] || "");

		// TikTok videos are typically optimized for mobile
		const baseSizePerSecond = quality === "hd" ? 0.25 : 0.12;
		const estimatedSize = duration * baseSizePerSecond;

		return `${estimatedSize.toFixed(1)} MB`;
	}

	/**
	 * Enhanced quality detection for TikTok videos
	 */
	protected determineQuality(url: string): "hd" | "sd" | "unknown" {
		const lowerUrl = url.toLowerCase();

		// TikTok-specific quality indicators
		if (
			lowerUrl.includes("720") ||
			lowerUrl.includes("1080") ||
			lowerUrl.includes("hd") ||
			lowerUrl.includes("high") ||
			lowerUrl.includes("aweme-vd-play")
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
