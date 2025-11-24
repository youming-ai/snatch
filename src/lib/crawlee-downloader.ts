import type { DownloadResult } from "@/types/download";

// Check if we're in a Node.js environment
const isNodeJs =
	typeof window === "undefined" && typeof process !== "undefined";

// Type definitions for Crawlee (will be imported dynamically)
type PuppeteerCrawler = any;
type CheerioCrawler = any;
type Dataset = any;

interface CrawleeOptions {
	/**
	 * Maximum number of requests per crawl
	 */
	maxRequestsPerCrawl?: number;
	/**
	 * Whether to use headless mode
	 */
	headless?: boolean;
	/**
	 * Request timeout in milliseconds
	 */
	requestHandlerTimeoutSecs?: number;
	/**
	 * Navigation timeout in milliseconds
	 */
	navigationTimeoutSecs?: number;
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
}

/**
 * Base Crawlee-based downloader with browser automation capabilities
 */
export abstract class CrawleeDownloader {
	protected crawler: PuppeteerCrawler | CheerioCrawler;
	protected platform: string;
	protected dataset: Dataset | null = null;
	protected isInitialized = false;

	constructor(platform: string, options: CrawleeOptions = {}) {
		this.platform = platform;
		this.options = options;
		this.crawler = this.createMockCrawler(); // Initialize with mock crawler
	}

	protected options: CrawleeOptions;

	/**
	 * Initialize the real crawler (async)
	 */
	protected async initializeCrawler(): Promise<void> {
		this.crawler = await this.createCrawler(this.options);
	}

	/**
	 * Create a crawler instance with platform-specific configuration
	 */
	protected async createCrawler(options: CrawleeOptions): Promise<any> {
		const defaultOptions = {
			maxRequestsPerCrawl: 1,
			headless: true,
			requestHandlerTimeoutSecs: 30,
			navigationTimeoutSecs: 30,
			...options,
		};

		// Most social media platforms require JavaScript rendering
		return await this.createPuppeteerCrawler(defaultOptions);
	}

	/**
	 * Create PuppeteerCrawler with stealth capabilities
	 */
	protected async createPuppeteerCrawler(
		options: CrawleeOptions,
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

			// Find system Chrome path
			const systemChromePath =
				"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

			return new PuppeteerCrawler({
				// Use puppeteer-extra with stealth plugin
				launchContext: {
					launcher: puppeteer,
					launchOptions: {
						headless: options.headless,
						executablePath: systemChromePath,
						args: [
							"--no-sandbox",
							"--disable-setuid-sandbox",
							"--disable-dev-shm-usage",
							"--disable-web-security",
							"--disable-features=VizDisplayCompositor",
							"--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
						],
					},
				},
				// Browser fingerprinting to avoid detection
				browserPoolOptions: {
					useFingerprints: true,
					fingerprintOptions: {
						fingerprintGeneratorOptions: {
							browsers: [BrowserName.chrome],
							devices: [DeviceCategory.desktop],
							locales: ["en-US"],
						},
					},
				},
				// Limit crawl scope
				maxRequestsPerCrawl: options.maxRequestsPerCrawl || 1,
				requestHandlerTimeoutSecs: options.requestHandlerTimeoutSecs || 30,
				navigationTimeoutSecs: options.navigationTimeoutSecs || 30,

				// Main request handler - to be implemented by subclasses
				requestHandler: async ({ request, page, log }) => {
					log.info(`Processing ${request.url}...`);

					try {
						// Wait for page to load
						try {
							await page.waitForNetworkIdle({ timeout: 10000 });
						} catch (e) {
							log.warning("Wait for network idle timed out, continuing...");
						}

						// Platform-specific extraction
						const extractedData = await this.extractFromPage(
							page,
							request.url,
							log,
						);

						if (extractedData) {
							// Import Dataset dynamically
							const { Dataset } = await import("crawlee");
							// Store results in dataset
							await Dataset.pushData(extractedData);
						}
					} catch (error) {
						log.error(`Error processing ${request.url}:`, error);
						throw error;
					}
				},

				// Failed request handler
				async failedRequestHandler({ request, log }) {
					log.error(`Request ${request.url} failed too many times.`);
				},
			});
		} catch (error) {
			console.error("Failed to initialize PuppeteerCrawler:", error);
			return this.createMockCrawler();
		}
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
	 * Extract data using page evaluation
	 */
	protected async evaluatePage<T>(
		page: any,
		evaluateFunction: () => T,
	): Promise<T> {
		try {
			return await page.evaluate(evaluateFunction);
		} catch (error) {
			console.error(`Error evaluating page:`, error);
			throw error;
		}
	}

	/**
	 * Wait for specific selectors to appear
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
				console.warn(`Selector ${selector} not found within timeout`);
			}
		}
	}

	/**
	 * Extract video URLs from page
	 */
	protected async extractVideoUrls(page: any): Promise<string[]> {
		const videoUrls = await this.evaluatePage(page, () => {
			const urls: string[] = [];

			// Method 1: Video elements
			document.querySelectorAll("video").forEach((video) => {
				if (video.src) urls.push(video.src);
				video.querySelectorAll("source").forEach((source) => {
					if (source.src) urls.push(source.src);
				});
			});

			// Method 2: JavaScript variables
			if (typeof window !== "undefined") {
				// Common variable names for video data
				const videoVars = [
					"__INITIAL_DATA__",
					"__NUXT__",
					"__INITIAL_STATE__",
					"__PRELOADED_STATE__",
				];

				videoVars.forEach((varName) => {
					if ((window as any)[varName]) {
						try {
							const data = JSON.stringify((window as any)[varName]);
							const urlMatches = data.match(
								/https?:\/\/[^\s"']+\.(?:mp4|mov|webm|avi)/gi,
							);
							if (urlMatches) urls.push(...urlMatches);
						} catch (e) {
							// Ignore JSON parsing errors
						}
					}
				});
			}

			return [...new Set(urls)]; // Remove duplicates
		});

		return videoUrls as string[];
	}

	/**
	 * Extract image URLs from page
	 */
	protected async extractImageUrls(page: any): Promise<string[]> {
		const imageUrls = await this.evaluatePage(page, () => {
			const urls: string[] = [];

			// Image elements
			document.querySelectorAll("img").forEach((img) => {
				if (img.src && !img.src.includes("data:")) {
					urls.push(img.src);
				}
			});

			// Meta tags for Open Graph images
			document
				.querySelectorAll(
					'meta[property="og:image"], meta[name="twitter:image"]',
				)
				.forEach((meta) => {
					const content = meta.getAttribute("content");
					if (content) urls.push(content);
				});

			return [...new Set(urls)]; // Remove duplicates
		});

		return imageUrls as string[];
	}

	/**
	 * Extract page metadata
	 */
	protected async extractMetadata(page: any): Promise<ExtractedData> {
		const metadata = await this.evaluatePage(page, () => {
			const getMetaContent = (property: string): string | undefined => {
				const meta = document.querySelector(
					`meta[property="${property}"], meta[name="${property}"]`,
				);
				return meta?.getAttribute("content") || undefined;
			};

			const getTitle = (): string => {
				const titleElement = document.querySelector("title");
				return titleElement?.textContent || "";
			};

			return {
				title:
					getTitle() ||
					getMetaContent("og:title") ||
					getMetaContent("twitter:title"),
				content:
					getMetaContent("og:description") || getMetaContent("description"),
				author: getMetaContent("author") || getMetaContent("article:author"),
				thumbnailUrl:
					getMetaContent("og:image") || getMetaContent("twitter:image"),
			};
		});

		const videoUrls = await this.extractVideoUrls(page);
		const imageUrls = await this.extractImageUrls(page);

		return {
			...(metadata as any),
			videoUrls,
			imageUrls,
		};
	}

	/**
	 * Convert extracted data to DownloadResult format
	 */
	protected createDownloadResults(
		extractedData: ExtractedData,
		originalUrl: string,
	): DownloadResult[] {
		const results: DownloadResult[] = [];
		const contentId = this.extractContentId(originalUrl);

		// Add video results
		extractedData.videoUrls.forEach((videoUrl, index) => {
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
				size: "Unknown",
				platform: this.platform as any,
				quality: this.determineQuality(videoUrl),
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
	 * Extract content ID from URL - to be implemented by subclasses
	 */
	protected abstract extractContentId(url: string): string;

	/**
	 * Determine video quality from URL
	 */
	protected determineQuality(url: string): "hd" | "sd" | "unknown" {
		const lowerUrl = url.toLowerCase();
		if (
			lowerUrl.includes("hd") ||
			lowerUrl.includes("720") ||
			lowerUrl.includes("1080")
		) {
			return "hd";
		}
		if (
			lowerUrl.includes("sd") ||
			lowerUrl.includes("480") ||
			lowerUrl.includes("360")
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
		return `https://via.placeholder.com/400x300/${color}?text=${this.platform.charAt(0).toUpperCase() + this.platform.slice(1)}+Content`;
	}

	/**
	 * Main download method using Crawlee
	 */
	async download(url: string): Promise<DownloadResult[]> {
		try {
			console.log(`🔄 [Crawlee] Starting ${this.platform} download for:`, url);

			// Check if we're in a browser environment
			if (!isNodeJs) {
				console.log(
					`⚠️ [Crawlee] Browser environment detected - Crawlee not available`,
				);
				throw new Error(
					"Crawlee requires Node.js environment for browser automation",
				);
			}

			// Initialize the real crawler if not already done
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
			const extractedData = items[0] as ExtractedData;

			if (!extractedData) {
				throw new Error(`No content found on this ${this.platform} page`);
			}

			const downloadResults = this.createDownloadResults(extractedData, url);
			console.log(
				`✅ [Crawlee] ${this.platform} download completed. Results:`,
				downloadResults.length,
			);

			return downloadResults;
		} catch (error) {
			console.error(`❌ [Crawlee] ${this.platform} download error:`, error);
			throw new Error(
				error instanceof Error
					? error.message
					: `Failed to download ${this.platform} content`,
			);
		}
	}
}

export type { CrawleeOptions, ExtractedData };
