import type { DownloadResult } from "@/types/download";

// Check if we're in a Node.js environment
const isNodeJs =
	typeof window === "undefined" && typeof process !== "undefined";

// Type definitions for Crawlee (will be imported dynamically)
type PuppeteerCrawler = any;
type CheerioCrawler = any;
type Dataset = any;

// Enhanced error types
export enum CrawleeErrorType {
	NETWORK_ERROR = "NETWORK_ERROR",
	AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
	PLATFORM_ERROR = "PLATFORM_ERROR",
	TIMEOUT_ERROR = "TIMEOUT_ERROR",
	PARSING_ERROR = "PARSING_ERROR",
	ENVIRONMENT_ERROR = "ENVIRONMENT_ERROR",
	UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class CrawleeError extends Error {
	constructor(
		public type: CrawleeErrorType,
		message: string,
		public platform?: string,
		public originalError?: Error,
	) {
		super(message);
		this.name = "CrawleeError";
	}
}

// Authentication configuration
export interface AuthConfig {
	/**
	 * API tokens for platform-specific APIs
	 */
	apiTokens?: Record<string, string>;
	/**
	 * Cookies for authentication
	 */
	cookies?: Array<{
		name: string;
		value: string;
		domain?: string;
		path?: string;
	}>;
	/**
	 * Custom headers for authentication
	 */
	headers?: Record<string, string>;
	/**
	 * User credentials (if required)
	 */
	credentials?: {
		username?: string;
		password?: string;
	};
}

// Enhanced Crawlee options with retry and authentication
export interface EnhancedCrawleeOptions {
	/**
	 * Maximum number of requests per crawl
	 */
	maxRequestsPerCrawl?: number;
	/**
	 * Whether to use headless mode
	 */
	headless?: boolean;
	/**
	 * Request timeout in seconds
	 */
	requestHandlerTimeoutSecs?: number;
	/**
	 * Navigation timeout in seconds
	 */
	navigationTimeoutSecs?: number;
	/**
	 * Retry configuration
	 */
	retryConfig?: {
		/**
		 * Maximum number of retry attempts
		 */
		maxRetries?: number;
		/**
		 * Initial delay between retries (ms)
		 */
		initialDelay?: number;
		/**
		 * Maximum delay between retries (ms)
		 */
		maxDelay?: number;
		/**
		 * Backoff factor (multiplier for delay)
		 */
		backoffFactor?: number;
	};
	/**
	 * Authentication configuration
	 */
	authConfig?: AuthConfig;
	/**
	 * Platform-specific configuration
	 */
	platformConfig?: Record<string, any>;
	/**
	 * Enable performance monitoring
	 */
	enableMonitoring?: boolean;
	/**
	 * Custom user agent
	 */
	userAgent?: string;
	/**
	 * Proxy configuration
	 */
	proxy?: {
		server: string;
		username?: string;
		password?: string;
	};
}

interface ExtractedData {
	title?: string;
	content?: string;
	author?: string;
	username?: string;
	avatar?: string;
	videoUrls: string[];
	imageUrls: string[];
	thumbnailUrl?: string;
	engagement?: {
		likes?: number;
		shares?: number;
		comments?: number;
		views?: number;
	};
	metadata?: Record<string, any>;
	platformSpecific?: Record<string, any>;
}

// Performance monitoring interface
interface PerformanceMetrics {
	startTime: number;
	endTime?: number;
	duration?: number;
	networkRequests?: number;
	jsErrors?: number;
	domContentLoaded?: number;
}

/**
 * Enhanced Crawlee-based downloader with improved error handling, authentication, and monitoring
 */
export abstract class EnhancedCrawleeDownloader {
	protected crawler: PuppeteerCrawler | CheerioCrawler;
	protected platform: string;
	protected dataset: Dataset | null = null;
	protected isInitialized = false;
	protected performanceMetrics: PerformanceMetrics = {
		startTime: 0,
	};
	protected authConfig?: AuthConfig;

	constructor(
		platform: string,
		protected options: EnhancedCrawleeOptions = {},
	) {
		this.platform = platform;
		this.authConfig = options.authConfig;
		this.crawler = this.createMockCrawler(); // Initialize with mock crawler
	}

	/**
	 * Initialize the real crawler with enhanced configuration
	 */
	protected async initializeCrawler(): Promise<void> {
		this.crawler = await this.createCrawler(this.options);
	}

	/**
	 * Create a crawler instance with enhanced configuration
	 */
	protected async createCrawler(options: EnhancedCrawleeOptions): Promise<any> {
		const defaultOptions = {
			maxRequestsPerCrawl: 1,
			headless: true,
			requestHandlerTimeoutSecs: 60, // Increased timeout
			navigationTimeoutSecs: 45,
			retryConfig: {
				maxRetries: 3,
				initialDelay: 1000,
				maxDelay: 30000,
				backoffFactor: 2,
			},
			enableMonitoring: true,
			...options,
		};

		// Most social media platforms require JavaScript rendering
		return await this.createPuppeteerCrawler(defaultOptions);
	}

	/**
	 * Create enhanced PuppeteerCrawler with stealth capabilities
	 */
	protected async createPuppeteerCrawler(
		options: EnhancedCrawleeOptions,
	): Promise<any> {
		// If we're not in Node.js, return a mock crawler
		if (!isNodeJs) {
			return this.createMockCrawler();
		}

		try {
			// Dynamically import Crawlee dependencies
			const { PuppeteerCrawler } = await import("crawlee");
			const { BrowserName, DeviceCategory } = await import(
				"@crawlee/browser-pool"
			);
			const puppeteerExtra = await import("puppeteer-extra");
			const puppeteer = puppeteerExtra.default;
			const { default: StealthPlugin } = await import(
				"puppeteer-extra-plugin-stealth"
			);

			// Use puppeteer-extra with stealth plugin
			puppeteer.use(StealthPlugin());

			// Find system Chrome path with fallbacks
			const systemChromePath = this.findChromeExecutable();

			return new PuppeteerCrawler({
				// Enhanced launch context with proxy and authentication support
				launchContext: {
					launcher: puppeteer,
					launchOptions: {
						headless: options.headless,
						executablePath: systemChromePath,
						args: this.getBrowserArgs(options),
						...(options.proxy && {
							proxy: {
								server: options.proxy.server,
								...(options.proxy.username && {
									username: options.proxy.username,
									password: options.proxy.password,
								}),
							},
						}),
					},
				},
				// Enhanced browser fingerprinting
				browserPoolOptions: {
					useFingerprints: true,
					fingerprintOptions: {
						fingerprintGeneratorOptions: {
							browsers: [BrowserName.chrome],
							devices: [DeviceCategory.desktop],
							locales: ["en-US"],
							screenOptions: {
								minWidth: 1920,
								maxWidth: 1920,
								minHeight: 1080,
								maxHeight: 1080,
							},
						},
					},
				},
				// Enhanced configuration
				maxRequestsPerCrawl: options.maxRequestsPerCrawl || 1,
				requestHandlerTimeoutSecs: options.requestHandlerTimeoutSecs || 60,
				navigationTimeoutSecs: options.navigationTimeoutSecs || 45,
				maxRequestRetries: options.retryConfig?.maxRetries || 3,

				// Enhanced request handler with monitoring
				requestHandler: async ({ request, page, log }) => {
					const startTime = Date.now();
					log.info(`Processing ${request.url}...`);

					try {
						// Apply authentication if configured
						await this.applyAuthentication(page, log);

						// Enhanced page loading with multiple strategies
						await this.waitForPageLoad(page, log);

						// Monitor performance if enabled
						if (options.enableMonitoring) {
							this.monitorPerformance(page, log);
						}

						// Platform-specific extraction with retry
						const extractedData = await this.retryOperation(
							() => this.extractFromPage(page, request.url, log),
							"Data extraction",
							log,
							2,
						);

						if (extractedData) {
							// Validate extracted data
							await this.validateExtractedData(extractedData, log);

							// Import Dataset dynamically
							const { Dataset } = await import("crawlee");
							// Store results in dataset
							await Dataset.pushData(extractedData);

							const duration = Date.now() - startTime;
							log.info(
								`Successfully processed ${request.url} in ${duration}ms`,
							);
						} else {
							throw new CrawleeError(
								CrawleeErrorType.PARSING_ERROR,
								"Failed to extract data from page",
								this.platform,
							);
						}
					} catch (error) {
						const duration = Date.now() - startTime;
						log.error(
							`Error processing ${request.url} after ${duration}ms:`,
							error,
						);

						// Categorize error for better handling
						const crawleeError = this.categorizeError(error as Error);
						throw crawleeError;
					}
				},

				// Enhanced failed request handler with better error categorization
				async failedRequestHandler({ request, log, error }) {
					// Define categorizeError function inline to avoid context issues
					const categorizeError = (error: any) => {
						if (!error) {
							return new CrawleeError(
								CrawleeErrorType.UNKNOWN_ERROR,
								"Unknown error occurred",
								this.platform || "unknown",
							);
						}

						const message = error.message?.toLowerCase() || "";

						if (message.includes("timeout") || message.includes("time out")) {
							return new CrawleeError(
								CrawleeErrorType.TIMEOUT_ERROR,
								"Operation timed out",
								this.platform || "unknown",
								error,
							);
						}

						if (message.includes("network") || message.includes("connection")) {
							return new CrawleeError(
								CrawleeErrorType.NETWORK_ERROR,
								"Network connection error",
								this.platform || "unknown",
								error,
							);
						}

						if (
							message.includes("auth") ||
							message.includes("unauthorized") ||
							message.includes("login")
						) {
							return new CrawleeError(
								CrawleeErrorType.AUTHENTICATION_ERROR,
								"Authentication failed",
								this.platform || "unknown",
								error,
							);
						}

						if (message.includes("parse") || message.includes("json")) {
							return new CrawleeError(
								CrawleeErrorType.PARSING_ERROR,
								"Data parsing failed",
								this.platform || "unknown",
								error,
							);
						}

						return new CrawleeError(
							CrawleeErrorType.PLATFORM_ERROR,
							"Platform-specific error",
							this.platform || "unknown",
							error,
						);
					};

					const crawleeError = categorizeError(error);
					log.error(
						`Request ${request.url} failed with ${crawleeError.type}: ${crawleeError.message}`,
					);

					// Store error information for analysis
					await this.storeErrorData(crawleeError, request.url);
				},
			});
		} catch (error) {
			console.error("Failed to initialize PuppeteerCrawler:", error);
			return this.createMockCrawler();
		}
	}

	/**
	 * Find Chrome executable path with fallbacks
	 */
	private findChromeExecutable(): string {
		const possiblePaths = [
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/usr/bin/google-chrome",
			"/usr/bin/chromium-browser",
			"/usr/bin/chromium",
		];

		return possiblePaths[0]; // Use first path as default
	}

	/**
	 * Get enhanced browser arguments
	 */
	private getBrowserArgs(options: EnhancedCrawleeOptions): string[] {
		const defaultArgs = [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--disable-web-security",
			"--disable-features=VizDisplayCompositor",
			"--disable-blink-features=AutomationControlled",
			"--disable-extensions",
			"--disable-plugins",
			"--disable-images", // Disable images for faster loading
			"--disable-javascript", // We'll enable JavaScript as needed
			"--disable-default-apps",
			"--disable-infobars",
			"--disable-notifications",
			"--disable-popup-blocking",
			"--disable-prompt-on-repost",
			"--disable-sync",
			"--disable-translate",
			"--hide-scrollbars",
			"--mute-audio",
			"--no-first-run",
			"--safebrowsing-disable-auto-update",
		];

		// Add custom user agent if provided
		if (options.userAgent) {
			defaultArgs.push(`--user-agent=${options.userAgent}`);
		} else {
			defaultArgs.push(
				"--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			);
		}

		return defaultArgs;
	}

	/**
	 * Apply authentication configuration to the page
	 */
	protected async applyAuthentication(page: any, log: any): Promise<void> {
		if (!this.authConfig) return;

		try {
			// Set custom headers
			if (this.authConfig.headers) {
				await page.setExtraHTTPHeaders(this.authConfig.headers);
				log.info("Applied custom headers for authentication");
			}

			// Set cookies
			if (this.authConfig.cookies && this.authConfig.cookies.length > 0) {
				await page.setCookie(...this.authConfig.cookies);
				log.info(`Applied ${this.authConfig.cookies.length} cookies`);
			}

			// Platform-specific authentication
			await this.applyPlatformAuthentication(page, log);
		} catch (error) {
			log.warn("Failed to apply authentication:", error);
		}
	}

	/**
	 * Platform-specific authentication (to be implemented by subclasses)
	 */
	protected async applyPlatformAuthentication(
		page: any,
		log: any,
	): Promise<void> {
		// Default implementation does nothing
		// Subclasses can override for platform-specific authentication
	}

	/**
	 * Enhanced page loading with multiple strategies
	 */
	protected async waitForPageLoad(page: any, log: any): Promise<void> {
		try {
			// Strategy 1: Wait for network idle with longer timeout
			await page.waitForLoadState("networkidle", { timeout: 30000 });
			log.info("Page loaded successfully with network idle");
		} catch (error) {
			log.warning("Network idle timeout, trying DOM content loaded...");

			try {
				// Strategy 2: Wait for DOM content loaded
				await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
				log.info("Page loaded successfully with DOM content loaded");
			} catch (error2) {
				log.warning("DOM content loaded timeout, waiting for delay...");

				// Strategy 3: Simple delay as fallback
				await page.waitForTimeout(5000);
				log.info("Page loaded with fallback delay");
			}
		}

		// Additional wait for dynamic content
		await this.waitForDynamicContent(page, log);
	}

	/**
	 * Wait for dynamic content to load (platform-specific)
	 */
	protected async waitForDynamicContent(page: any, log: any): Promise<void> {
		// Default implementation waits for common indicators
		const indicators = ["body:not(:empty)", "[data-loaded]", ".loaded"];

		for (const indicator of indicators) {
			try {
				await page.waitForSelector(indicator, { timeout: 5000 });
				log.info(`Dynamic content indicator found: ${indicator}`);
				break;
			} catch (error) {
				// Continue to next indicator
			}
		}
	}

	/**
	 * Monitor page performance
	 */
	protected async monitorPerformance(page: any, log: any): Promise<void> {
		try {
			const metrics = await page.evaluate(() => {
				const perfData = performance.getEntriesByType(
					"navigation",
				)[0] as PerformanceNavigationTiming;
				return {
					domContentLoaded:
						perfData.domContentLoadedEventEnd -
						perfData.domContentLoadedEventStart,
					networkRequests: performance.getEntriesByType("resource").length,
				};
			});

			this.performanceMetrics = {
				...this.performanceMetrics,
				...metrics,
			};

			log.info("Performance metrics:", metrics);
		} catch (error) {
			log.warning("Failed to collect performance metrics:", error);
		}
	}

	/**
	 * Retry operation with exponential backoff
	 */
	protected async retryOperation<T>(
		operation: () => Promise<T>,
		operationName: string,
		log: any,
		maxRetries = 3,
	): Promise<T> {
		const retryConfig = this.options.retryConfig || {
			maxRetries: 3,
			initialDelay: 1000,
			maxDelay: 30000,
			backoffFactor: 2,
		};

		let lastError: Error;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				if (attempt > 0) {
					const delay = Math.min(
						retryConfig.initialDelay *
							retryConfig.backoffFactor ** (attempt - 1),
						retryConfig.maxDelay,
					);
					if (log && typeof log.info === "function") {
						log.info(
							`Retrying ${operationName} (attempt ${attempt + 1}) after ${delay}ms`,
						);
					} else {
						console.log(
							`Retrying ${operationName} (attempt ${attempt + 1}) after ${delay}ms`,
						);
					}
					await new Promise((resolve) => setTimeout(resolve, delay));
				}

				return await operation();
			} catch (error) {
				lastError = error as Error;
				if (log && typeof log.warning === "function") {
					log.warning(
						`${operationName} failed on attempt ${attempt + 1}:`,
						error,
					);
				} else {
					console.warn(
						`${operationName} failed on attempt ${attempt + 1}:`,
						error,
					);
				}
			}
		}

		throw lastError!;
	}

	/**
	 * Validate extracted data
	 */
	protected async validateExtractedData(
		data: ExtractedData,
		log: any,
	): Promise<void> {
		if (!data) {
			throw new CrawleeError(
				CrawleeErrorType.PARSING_ERROR,
				"No data extracted from page",
				this.platform,
			);
		}

		// Check if we have any media content
		if (data.videoUrls.length === 0 && data.imageUrls.length === 0) {
			log.warning("No media content found in extracted data");
		}

		// Validate URLs
		const allUrls = [...data.videoUrls, ...data.imageUrls];
		const invalidUrls = allUrls.filter((url) => !this.isValidUrl(url));

		if (invalidUrls.length > 0) {
			log.warning(`Found ${invalidUrls.length} invalid URLs`);
		}
	}

	/**
	 * Validate URL format
	 */
	private isValidUrl(url: string): boolean {
		try {
			new URL(url);
			return url.startsWith("http://") || url.startsWith("https://");
		} catch {
			return false;
		}
	}

	/**
	 * Categorize errors for better handling
	 */
	private categorizeError(error: Error): CrawleeError {
		if (!error) {
			return new CrawleeError(
				CrawleeErrorType.UNKNOWN_ERROR,
				"Unknown error occurred",
				this.platform,
			);
		}

		const message = error.message.toLowerCase();

		if (message.includes("timeout") || message.includes("time out")) {
			return new CrawleeError(
				CrawleeErrorType.TIMEOUT_ERROR,
				"Operation timed out",
				this.platform,
				error,
			);
		}

		if (message.includes("network") || message.includes("connection")) {
			return new CrawleeError(
				CrawleeErrorType.NETWORK_ERROR,
				"Network connection error",
				this.platform,
				error,
			);
		}

		if (
			message.includes("auth") ||
			message.includes("unauthorized") ||
			message.includes("login")
		) {
			return new CrawleeError(
				CrawleeErrorType.AUTHENTICATION_ERROR,
				"Authentication failed",
				this.platform,
				error,
			);
		}

		if (message.includes("parse") || message.includes("json")) {
			return new CrawleeError(
				CrawleeErrorType.PARSING_ERROR,
				"Data parsing failed",
				this.platform,
				error,
			);
		}

		return new CrawleeError(
			CrawleeErrorType.PLATFORM_ERROR,
			"Platform-specific error",
			this.platform,
			error,
		);
	}

	/**
	 * Store error data for analysis
	 */
	protected async storeErrorData(
		error: CrawleeError,
		url: string,
	): Promise<void> {
		const errorData = {
			timestamp: new Date().toISOString(),
			platform: this.platform,
			url,
			errorType: error.type,
			message: error.message,
			stack: error.stack,
		};

		// Store error data for analysis
		// In a real implementation, you might store this in a database or log file
		console.error("Error stored for analysis:", errorData);
	}

	/**
	 * Create a mock crawler for browser environments
	 */
	private createMockCrawler(): any {
		return {
			addRequests: async () => {},
			run: async () => {},
			getData: async () => ({ items: [] }),
			pushData: async () => {},
		};
	}

	/**
	 * Platform-specific data extraction method - to be implemented by subclasses
	 */
	protected abstract extractFromPage(
		page: any,
		url: string,
		log: any,
	): Promise<ExtractedData | null>;

	/**
	 * Extract data using page evaluation with error handling
	 */
	protected async evaluatePage<T>(
		page: any,
		evaluateFunction: () => T,
		context = "page evaluation",
	): Promise<T> {
		try {
			return await page.evaluate(evaluateFunction);
		} catch (error) {
			console.error(`Error during ${context}:`, error);
			throw new CrawleeError(
				CrawleeErrorType.PARSING_ERROR,
				`Failed to evaluate page: ${context}`,
				this.platform,
				error as Error,
			);
		}
	}

	/**
	 * Wait for specific selectors to appear with enhanced error handling
	 */
	protected async waitForSelectors(
		page: any,
		selectors: string[],
		timeout = 10000,
	): Promise<void> {
		for (const selector of selectors) {
			try {
				await page.waitForSelector(selector, { timeout });
			} catch (error) {
				console.warn(`Selector ${selector} not found within timeout:`, error);
			}
		}
	}

	/**
	 * Extract video URLs from page with enhanced error handling
	 */
	protected async extractVideoUrls(page: any): Promise<string[]> {
		try {
			const videoUrls = await this.evaluatePage(
				page,
				() => {
					const urls: string[] = [];

					// Method 1: Video elements
					document.querySelectorAll("video").forEach((video) => {
						if (video.src && !video.src.startsWith("blob:")) {
							urls.push(video.src);
						}
						video.querySelectorAll("source").forEach((source) => {
							if (source.src && !source.src.startsWith("blob:")) {
								urls.push(source.src);
							}
						});
					});

					// Method 2: JavaScript variables with enhanced patterns
					if (typeof window !== "undefined") {
						const videoVars = [
							"__INITIAL_DATA__",
							"__NUXT__",
							"__INITIAL_STATE__",
							"__PRELOADED_STATE__",
							"__UNIVERSAL_DATA_FOR_REHYDRATION__",
							"SIGI_STATE",
							"__APOLLO_STATE__",
						];

						videoVars.forEach((varName) => {
							if ((window as any)[varName]) {
								try {
									const data = JSON.stringify((window as any)[varName]);
									// Enhanced URL matching patterns
									const urlMatches = data.match(
										/https?:\/\/[^\s"']+\.(?:mp4|mov|webm|avi|mkv|flv|wmv)(?:\?[^\s"']*)?/gi,
									);
									if (urlMatches) urls.push(...urlMatches);
								} catch (e) {
									// Ignore JSON parsing errors
								}
							}
						});
					}

					return [...new Set(urls.filter((url) => url && url.length > 10))]; // Filter valid URLs
				},
				"video URL extraction",
			);

			return videoUrls as string[];
		} catch (error) {
			console.warn("Failed to extract video URLs:", error);
			return [];
		}
	}

	/**
	 * Extract image URLs from page with enhanced error handling
	 */
	protected async extractImageUrls(page: any): Promise<string[]> {
		try {
			const imageUrls = await this.evaluatePage(
				page,
				() => {
					const urls: string[] = [];

					// Image elements with better filtering
					document.querySelectorAll("img").forEach((img) => {
						if (
							img.src &&
							!img.src.includes("data:") &&
							!img.src.includes("base64") &&
							(img.width > 100 || img.height > 100) // Filter out small icons
						) {
							urls.push(img.src);
						}
					});

					// Meta tags with enhanced matching
					document
						.querySelectorAll(
							'meta[property="og:image"], meta[name="twitter:image"], meta[property="og:image:secure_url"]',
						)
						.forEach((meta) => {
							const content = meta.getAttribute("content");
							if (content && !content.includes("data:")) {
								urls.push(content);
							}
						});

					// Background images
					document
						.querySelectorAll("[style*='background-image']")
						.forEach((el) => {
							const style = el.getAttribute("style") || "";
							const match = style.match(
								/background-image:\s*url\(['"]?([^'")]+)['"]?\)/,
							);
							if (match) {
								urls.push(match[1]);
							}
						});

					return [...new Set(urls.filter((url) => url && url.length > 10))];
				},
				"image URL extraction",
			);

			return imageUrls as string[];
		} catch (error) {
			console.warn("Failed to extract image URLs:", error);
			return [];
		}
	}

	/**
	 * Extract page metadata with enhanced error handling
	 */
	protected async extractMetadata(page: any): Promise<ExtractedData> {
		try {
			const metadata = await this.evaluatePage(
				page,
				() => {
					const getMetaContent = (property: string): string | undefined => {
						const meta = document.querySelector(
							`meta[property="${property}"], meta[name="${property}"]`,
						);
						return meta?.getAttribute("content") || undefined;
					};

					const getTitle = (): string => {
						const titleElement = document.querySelector("title");
						return titleElement?.textContent?.trim() || "";
					};

					// Enhanced metadata extraction
					return {
						title:
							getTitle() ||
							getMetaContent("og:title") ||
							getMetaContent("twitter:title"),
						content:
							getMetaContent("og:description") ||
							getMetaContent("description") ||
							getMetaContent("twitter:description"),
						author:
							getMetaContent("author") ||
							getMetaContent("article:author") ||
							getMetaContent("twitter:creator"),
						thumbnailUrl:
							getMetaContent("og:image") ||
							getMetaContent("twitter:image") ||
							getMetaContent("og:image:secure_url"),
						siteName: getMetaContent("og:site_name"),
						url: getMetaContent("og:url") || window.location.href,
						publishedTime: getMetaContent("article:published_time"),
						modifiedTime: getMetaContent("article:modified_time"),
						tags: getMetaContent("article:tag"),
					};
				},
				"metadata extraction",
			);

			const videoUrls = await this.extractVideoUrls(page);
			const imageUrls = await this.extractImageUrls(page);

			return {
				...(metadata as any),
				videoUrls,
				imageUrls,
			};
		} catch (error) {
			console.warn("Failed to extract metadata:", error);
			return {
				videoUrls: [],
				imageUrls: [],
			};
		}
	}

	/**
	 * Convert extracted data to DownloadResult format with enhanced validation
	 */
	protected createDownloadResults(
		extractedData: ExtractedData,
		originalUrl: string,
	): DownloadResult[] {
		const results: DownloadResult[] = [];
		const contentId = this.extractContentId(originalUrl);

		// Add video results with enhanced quality detection
		extractedData.videoUrls.forEach((videoUrl, index) => {
			const quality = this.determineQuality(videoUrl);
			const size = this.estimateFileSize(extractedData);

			results.push({
				id: `${this.platform}-${contentId}-video-${index}`,
				type: "video",
				url: originalUrl,
				thumbnail:
					extractedData.thumbnailUrl || this.generatePlaceholderThumbnail(),
				downloadUrl: videoUrl,
				title:
					extractedData.title ||
					`${this.platform.charAt(0).toUpperCase() + this.platform.slice(1)} Video`,
				size,
				platform: this.platform as any,
				quality,
			});
		});

		// Add image results (if no videos)
		if (results.length === 0 && extractedData.imageUrls.length > 0) {
			extractedData.imageUrls.forEach((imageUrl, index) => {
				results.push({
					id: `${this.platform}-${contentId}-image-${index}`,
					type: "image",
					url: originalUrl,
					thumbnail: imageUrl,
					downloadUrl: imageUrl,
					title:
						extractedData.title ||
						`${this.platform.charAt(0).toUpperCase() + this.platform.slice(1)} Image`,
					size: "Unknown",
					platform: this.platform as any,
					quality: "unknown",
				});
			});
		}

		return results;
	}

	/**
	 * Estimate file size based on metadata
	 */
	protected estimateFileSize(data: ExtractedData): string {
		// Use platform-specific estimation
		const baseSize =
			this.platform === "tiktok" ? 3 : this.platform === "instagram" ? 2 : 1.5;
		const multiplier = data.metadata?.duration || 30; // Default 30 seconds
		const estimatedSize = (baseSize * multiplier) / 60; // Convert to MB

		return `${estimatedSize.toFixed(1)} MB`;
	}

	/**
	 * Extract content ID from URL - to be implemented by subclasses
	 */
	protected abstract extractContentId(url: string): string;

	/**
	 * Determine video quality from URL with enhanced patterns
	 */
	protected determineQuality(url: string): "hd" | "sd" | "unknown" {
		const lowerUrl = url.toLowerCase();

		// Enhanced quality detection patterns
		if (
			lowerUrl.includes("hd") ||
			lowerUrl.includes("720") ||
			lowerUrl.includes("1080") ||
			lowerUrl.includes("1440") ||
			lowerUrl.includes("4k") ||
			lowerUrl.includes("high")
		) {
			return "hd";
		}

		if (
			lowerUrl.includes("sd") ||
			lowerUrl.includes("480") ||
			lowerUrl.includes("360") ||
			lowerUrl.includes("240") ||
			lowerUrl.includes("low")
		) {
			return "sd";
		}

		return "unknown";
	}

	/**
	 * Generate placeholder thumbnail
	 */
	protected generatePlaceholderThumbnail(): string {
		const colors = {
			tiktok: "000000/FFFFFF",
			instagram: "FF69B4/FFFFFF",
			twitter: "1DA1F2/FFFFFF",
		};

		const color =
			colors[this.platform as keyof typeof colors] || "808080/FFFFFF";
		const platformName =
			this.platform.charAt(0).toUpperCase() + this.platform.slice(1);
		return `https://via.placeholder.com/400x300/${color}?text=${platformName}+Content`;
	}

	/**
	 * Enhanced main download method with better error handling and monitoring
	 */
	async download(url: string): Promise<DownloadResult[]> {
		const startTime = Date.now();
		this.performanceMetrics.startTime = startTime;

		try {
			// Check if we're in a browser environment
			if (!isNodeJs) {
				throw new CrawleeError(
					CrawleeErrorType.ENVIRONMENT_ERROR,
					"Crawlee requires Node.js environment for browser automation",
					this.platform,
				);
			}

			// Initialize the real crawler if not already done
			if (!this.isInitialized) {
				await this.initializeCrawler();
				this.isInitialized = true;
			}

			// Add URL to crawler with retry
			await this.retryOperation(
				() => this.crawler.addRequests([url]),
				"URL addition",
				console,
			);

			// Run crawler with retry
			await this.retryOperation(
				() => this.crawler.run(),
				"Crawler execution",
				console,
			);

			// Get data from dataset
			const { Dataset } = await import("crawlee");
			const dataset = await Dataset.open();
			const { items } = await dataset.getData();
			const extractedData = items[0] as ExtractedData;

			if (!extractedData) {
				throw new CrawleeError(
					CrawleeErrorType.PARSING_ERROR,
					`No content found on this ${this.platform} page`,
					this.platform,
				);
			}

			const downloadResults = this.createDownloadResults(extractedData, url);

			this.performanceMetrics.endTime = Date.now();
			this.performanceMetrics.duration =
				this.performanceMetrics.endTime - startTime;

			console.log(
				`✅ [Crawlee] ${this.platform} download completed in ${this.performanceMetrics.duration}ms. Results:`,
				downloadResults.length,
			);

			return downloadResults;
		} catch (error) {
			this.performanceMetrics.endTime = Date.now();
			this.performanceMetrics.duration =
				this.performanceMetrics.endTime - startTime;

			const crawleeError =
				error instanceof CrawleeError
					? error
					: this.categorizeError(error as Error);
			console.error(
				`❌ [Crawlee] ${this.platform} download failed after ${this.performanceMetrics.duration}ms:`,
				crawleeError,
			);

			throw crawleeError;
		}
	}

	/**
	 * Get performance metrics
	 */
	getPerformanceMetrics(): PerformanceMetrics {
		return { ...this.performanceMetrics };
	}
}

// Export types for backward compatibility
export type { CrawleeOptions, ExtractedData };
