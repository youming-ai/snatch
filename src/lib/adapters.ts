// Import API-based downloaders (replacing Crawlee downloaders)
import { InstagramApiDownloader } from "@/lib/api-downloaders/instagram-api-downloader";
import { TikTokApiDownloader } from "@/lib/api-downloaders/tiktok-api-downloader";
import { TwitterApiDownloader } from "@/lib/api-downloaders/twitter-api-downloader";
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
 * Base adapter with common functionality using Crawlee
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

	abstract canHandle(url: string): boolean;
	abstract download(url: string): Promise<DownloadResult[]>;
	abstract extractId(url: string): string | null;
}

/**
 * Instagram adapter implementation using yt-dlp
 */
export class InstagramAdapter extends BasePlatformAdapter {
	readonly platform: SupportedPlatform = "instagram";
	readonly name = "Instagram";

	private readonly patterns = [
		/\/reel\/([A-Za-z0-9_-]+)/i,
		/\/p\/([A-Za-z0-9_-]+)/i,
		/\/tv\/([A-Za-z0-9_-]+)/i,
	];

	private apiDownloader = new InstagramApiDownloader();

	canHandle(url: string): boolean {
		return url.toLowerCase().includes("instagram.com");
	}

	extractId(url: string): string | null {
		return this.extractIdFromPatterns(url, this.patterns);
	}

	async download(url: string): Promise<DownloadResult[]> {
		console.log(`[${this.platform}] 📦 Using instagram-url-direct API downloader...`);
		const results = await this.apiDownloader.download(url);
		console.log(
			`[${this.platform}] ✅ API downloader succeeded with ${results.length} results`,
		);
		return results;
	}
}

/**
 * Twitter/X adapter implementation using twitter-scraper API
 */
export class TwitterAdapter extends BasePlatformAdapter {
	readonly platform: SupportedPlatform = "twitter";
	readonly name = "X (Twitter)";

	private readonly patterns = [/\/status\/(\d+)/i];

	private apiDownloader = new TwitterApiDownloader();

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
		console.log(`[${this.platform}] 📦 Using twitter-scraper API downloader...`);
		const results = await this.apiDownloader.download(url);
		console.log(
			`[${this.platform}] ✅ API downloader succeeded with ${results.length} results`,
		);
		return results;
	}
}

/**
 * TikTok adapter implementation using tiktok-api-dl
 */
export class TikTokAdapter extends BasePlatformAdapter {
	readonly platform: SupportedPlatform = "tiktok";
	readonly name = "TikTok";

	private readonly patterns = [/\/video\/(\d+)/i, /\/@[^/]+\/video\/(\d+)/i];

	private apiDownloader = new TikTokApiDownloader();

	canHandle(url: string): boolean {
		return url.toLowerCase().includes("tiktok.com");
	}

	extractId(url: string): string | null {
		return this.extractIdFromPatterns(url, this.patterns);
	}

	async download(url: string): Promise<DownloadResult[]> {
		console.log(`[${this.platform}] 📦 Using tiktok-api-dl downloader...`);
		const results = await this.apiDownloader.download(url);
		console.log(
			`[${this.platform}] ✅ API downloader succeeded with ${results.length} results`,
		);
		return results;
	}
}
