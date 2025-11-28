// Import Crawlee downloaders as fallback
import { InstagramCrawleeDownloader } from "@/lib/crawlee-downloaders/instagram-crawlee-downloader";
import { TikTokCrawleeDownloader } from "@/lib/crawlee-downloaders/tiktok-crawlee-downloader";
import { TwitterCrawleeDownloader } from "@/lib/crawlee-downloaders/twitter-crawlee-downloader";
import { InstagramDownloader } from "@/lib/native-downloaders/instagram";
import { TikTokDownloader } from "@/lib/native-downloaders/tiktok";
import { TwitterDownloader } from "@/lib/native-downloaders/twitter";
import type { DownloadResult, SupportedPlatform } from "@/types/download";

/**
 * Platform adapter interface for download operations
 */
export interface PlatformAdapter {
	readonly platform: SupportedPlatform;
	readonly name: string;

	/**
	 * Checks if the adapter can handle the given URL
	 */
	canHandle(url: string): boolean;

	/**
	 * Downloads content from the given URL
	 */
	download(url: string): Promise<DownloadResult[]>;

	/**
	 * Extracts content ID from URL
	 */
	extractId(url: string): string | null;
}

/**
 * Base adapter with common functionality and fallback mechanism
 */
abstract class BasePlatformAdapter implements PlatformAdapter {
	abstract readonly platform: SupportedPlatform;
	abstract readonly name: string;

	protected extractIdFromPatterns(
		url: string,
		patterns: RegExp[],
	): string | null {
		try {
			const urlObj = new URL(url);
			for (const pattern of patterns) {
				const match = urlObj.pathname.match(pattern);
				if (match?.[1]) {
					return match[1];
				}
			}
			return null;
		} catch {
			return null;
		}
	}

	protected generateBaseResult(
		id: string,
		originalUrl: string,
		thumbnail?: string,
	): Omit<DownloadResult, "downloadUrl" | "title"> {
		return {
			id,
			type: "video",
			url: originalUrl,
			thumbnail: thumbnail || this.getDefaultThumbnail(),
			size: "Unknown",
			platform: this.platform,
		};
	}

	protected getDefaultThumbnail(): string {
		return `https://via.placeholder.com/400x300/1a1a2e/16213e?text=${this.name.toUpperCase()}+Content`;
	}

	/**
	 * Execute download with fallback to Crawlee
	 */
	protected async executeDownloadWithFallback(
		nativeDownload: () => Promise<DownloadResult[]>,
		crawleeDownload: () => Promise<DownloadResult[]>,
		_url: string,
	): Promise<DownloadResult[]> {
		console.log(`[${this.platform}] Trying native downloader first...`);

		try {
			// Try native downloader first
			const nativeResults = await nativeDownload();
			console.log(
				`[${this.platform}] ✅ Native downloader succeeded with ${nativeResults.length} results`,
			);
			return nativeResults;
		} catch (nativeError) {
			console.warn(
				`[${this.platform}] ⚠️ Native downloader failed:`,
				nativeError instanceof Error ? nativeError.message : nativeError,
			);

			// Check if the error suggests Crawlee might succeed
			const shouldTryCrawlee = this.shouldTryCrawlee(nativeError);

			if (!shouldTryCrawlee) {
				throw new Error(
					`Native downloader failed and fallback is not recommended: ${nativeError instanceof Error ? nativeError.message : "Unknown error"}`,
				);
			}

			console.log(
				`[${this.platform}] 🔄 Fallback: Trying Crawlee downloader...`,
			);

			try {
				const crawleeResults = await crawleeDownload();
				console.log(
					`[${this.platform}] ✅ Crawlee fallback succeeded with ${crawleeResults.length} results`,
				);
				return crawleeResults.map((result) => ({
					...result,
					isFallback: true, // Mark results as coming from fallback
				}));
			} catch (crawleeError) {
				console.error(
					`[${this.platform}] ❌ Both native and Crawlee downloaders failed:`,
				);
				console.error(
					`  Native error:`,
					nativeError instanceof Error ? nativeError.message : nativeError,
				);
				console.error(
					`  Crawlee error:`,
					crawleeError instanceof Error ? crawleeError.message : crawleeError,
				);

				throw new Error(
					`Both downloaders failed. Native: ${nativeError instanceof Error ? nativeError.message : "Unknown error"}. Crawlee: ${crawleeError instanceof Error ? crawleeError.message : "Unknown error"}`,
				);
			}
		}
	}

	/**
	 * Determine if Crawlee fallback should be attempted based on the native error
	 */
	private shouldTryCrawlee(error: unknown): boolean {
		if (!error) return false;

		const errorMessage =
			error instanceof Error
				? error.message.toLowerCase()
				: String(error).toLowerCase();

		// Don't try Crawlee for these types of errors
		const noFallbackPatterns = [
			"invalid url",
			"not supported",
			"not found",
			"404",
			"private",
			"deleted",
			"access denied",
			"forbidden",
		];

		const shouldNotFallback = noFallbackPatterns.some((pattern) =>
			errorMessage.includes(pattern),
		);

		if (shouldNotFallback) {
			console.log(
				`[${this.platform}] Skipping Crawlee fallback due to error: ${errorMessage}`,
			);
			return false;
		}

		// Try Crawlee for these types of errors
		const fallbackPatterns = [
			"network",
			"timeout",
			"cors",
			"rate limit",
			"blocked",
			"scraper",
			"bot detected",
			"api limit",
			"server error",
			"502",
			"503",
			"504",
		];

		const shouldFallback = fallbackPatterns.some((pattern) =>
			errorMessage.includes(pattern),
		);

		return shouldFallback || errorMessage.length > 10; // Default to trying for unknown errors
	}

	abstract canHandle(url: string): boolean;
	abstract download(url: string): Promise<DownloadResult[]>;
	abstract extractId(url: string): string | null;
}

/**
 * Instagram adapter implementation
 */
export class InstagramAdapter extends BasePlatformAdapter {
	readonly platform: SupportedPlatform = "instagram";
	readonly name = "Instagram";

	private readonly patterns = [
		/\/reel\/([A-Za-z0-9_-]+)/i,
		/\/p\/([A-Za-z0-9_-]+)/i,
		/\/tv\/([A-Za-z0-9_-]+)/i,
	];

	private nativeDownloader = new InstagramDownloader();
	private crawleeDownloader = new InstagramCrawleeDownloader();

	canHandle(url: string): boolean {
		return url.toLowerCase().includes("instagram.com");
	}

	extractId(url: string): string | null {
		return this.extractIdFromPatterns(url, this.patterns);
	}

	async download(url: string): Promise<DownloadResult[]> {
		return this.executeDownloadWithFallback(
			() => this.nativeDownloader.download(url),
			() => this.crawleeDownloader.download(url),
			url,
		);
	}
}

/**
 * Twitter/X adapter implementation
 */
export class TwitterAdapter extends BasePlatformAdapter {
	readonly platform: SupportedPlatform = "twitter";
	readonly name = "X (Twitter)";

	private readonly patterns = [/\/status\/(\d+)/i];

	private nativeDownloader = new TwitterDownloader();
	private crawleeDownloader = new TwitterCrawleeDownloader();

	canHandle(url: string): boolean {
		const normalizedUrl = url.toLowerCase();
		return (
			normalizedUrl.includes("x.com") || normalizedUrl.includes("twitter.com")
		);
	}

	extractId(url: string): string | null {
		return this.extractIdFromPatterns(url, this.patterns);
	}

	async download(url: string): Promise<DownloadResult[]> {
		return this.executeDownloadWithFallback(
			() => this.nativeDownloader.download(url),
			() => this.crawleeDownloader.download(url),
			url,
		);
	}
}

/**
 * TikTok adapter implementation
 */
export class TikTokAdapter extends BasePlatformAdapter {
	readonly platform: SupportedPlatform = "tiktok";
	readonly name = "TikTok";

	private readonly patterns = [/\/video\/(\d+)/i, /\/@[^/]+\/video\/(\d+)/i];

	private nativeDownloader = new TikTokDownloader();
	private crawleeDownloader = new TikTokCrawleeDownloader();

	canHandle(url: string): boolean {
		return url.toLowerCase().includes("tiktok.com");
	}

	extractId(url: string): string | null {
		return this.extractIdFromPatterns(url, this.patterns);
	}

	async download(url: string): Promise<DownloadResult[]> {
		return this.executeDownloadWithFallback(
			() => this.nativeDownloader.download(url),
			() => this.crawleeDownloader.download(url),
			url,
		);
	}
}
