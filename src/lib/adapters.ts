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
 * Base adapter with common functionality
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

	private downloader = new InstagramDownloader();

	canHandle(url: string): boolean {
		return url.toLowerCase().includes("instagram.com");
	}

	extractId(url: string): string | null {
		return this.extractIdFromPatterns(url, this.patterns);
	}

	async download(url: string): Promise<DownloadResult[]> {
		try {
			return await this.downloader.download(url);
		} catch (error) {
			console.error("Instagram download error:", error);
			throw new Error(
				`Failed to download Instagram content: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}

/**
 * Twitter/X adapter implementation
 */
export class TwitterAdapter extends BasePlatformAdapter {
	readonly platform: SupportedPlatform = "twitter";
	readonly name = "X (Twitter)";

	private readonly patterns = [/\/status\/(\d+)/i];

	private downloader = new TwitterDownloader();

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
		try {
			return await this.downloader.download(url);
		} catch (error) {
			console.error("Twitter download error:", error);
			throw new Error(
				`Failed to download Twitter content: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}

/**
 * TikTok adapter implementation
 */
export class TikTokAdapter extends BasePlatformAdapter {
	readonly platform: SupportedPlatform = "tiktok";
	readonly name = "TikTok";

	private readonly patterns = [/\/video\/(\d+)/i, /\/@[^/]+\/video\/(\d+)/i];

	private downloader = new TikTokDownloader();

	canHandle(url: string): boolean {
		return url.toLowerCase().includes("tiktok.com");
	}

	extractId(url: string): string | null {
		return this.extractIdFromPatterns(url, this.patterns);
	}

	async download(url: string): Promise<DownloadResult[]> {
		try {
			return await this.downloader.download(url);
		} catch (error) {
			console.error("TikTok download error:", error);
			throw new Error(
				`Failed to download TikTok content: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}
