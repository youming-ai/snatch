import { detectPlatform } from "@/lib/validation";
import type {
	DownloadResponse,
	DownloadResult,
	SupportedPlatform,
} from "@/types/download";

/**
 * Client-side download service for limited server environments
 * Uses external APIs and client-side techniques instead of server-side scraping
 */
export class ClientDownloadService {
	private static instance: ClientDownloadService;

	private constructor() {}

	static getInstance(): ClientDownloadService {
		if (!ClientDownloadService.instance) {
			ClientDownloadService.instance = new ClientDownloadService();
		}
		return ClientDownloadService.instance;
	}

	/**
	 * Detect platform from URL
	 */
	detectPlatform(url: string): SupportedPlatform | null {
		return detectPlatform(url);
	}

	/**
	 * Download content using client-side methods
	 */
	async download(url: string): Promise<DownloadResponse> {
		try {
			const platform = this.detectPlatform(url);

			if (!platform) {
				return {
					success: false,
					error: "Unsupported platform or invalid URL",
				};
			}

			// Use different strategies based on platform:
			switch (platform) {
				case "instagram":
					return this.downloadFromInstagram(url);
				case "tiktok":
					return this.downloadFromTikTok(url);
				case "twitter":
					return this.downloadFromTwitter(url);
				default:
					return {
						success: false,
						error: "Platform not supported in client mode",
					};
			}
		} catch (error) {
			console.error("Client download error:", error);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	/**
	 * Instagram client-side download using oEmbed and metadata extraction
	 */
	private async downloadFromInstagram(url: string): Promise<DownloadResponse> {
		try {
			// Strategy 1: Try Instagram oEmbed API
			const oembedData = await this.fetchInstagramOEmbed(url);
			if (oembedData) {
				return this.createResponseFromOEmbed(oembedData, url, "instagram");
			}

			// Strategy 2: Fallback to metadata extraction
			const metadata = await this.extractMetadata(url);
			return this.createResponseFromMetadata(metadata, url, "instagram");
		} catch (error) {
			return this.createDemoResponse(url, "instagram", error);
		}
	}

	/**
	 * TikTok client-side download
	 */
	private async downloadFromTikTok(url: string): Promise<DownloadResponse> {
		try {
			const metadata = await this.extractMetadata(url);
			return this.createResponseFromMetadata(metadata, url, "tiktok");
		} catch (error) {
			return this.createDemoResponse(url, "tiktok", error);
		}
	}

	/**
	 * Twitter client-side download
	 */
	private async downloadFromTwitter(url: string): Promise<DownloadResponse> {
		try {
			const metadata = await this.extractMetadata(url);
			return this.createResponseFromMetadata(metadata, url, "twitter");
		} catch (error) {
			return this.createDemoResponse(url, "twitter", error);
		}
	}

	/**
	 * Fetch Instagram oEmbed data
	 */
	private async fetchInstagramOEmbed(url: string): Promise<{
		title?: string;
		html?: string;
		author_name?: string;
		author_url?: string;
		thumbnail_url?: string;
	}> {
		const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}&format=json&maxwidth=640`;

		const response = await fetch(oembedUrl, {
			headers: {
				Accept: "application/json",
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			},
		});

		if (!response.ok) {
			throw new Error(`oEmbed API failed: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Extract basic metadata from URL (client-side limited approach)
	 */
	private async extractMetadata(url: string): Promise<{
		title: string;
		description: string;
	}> {
		try {
			// Use a CORS proxy service for basic metadata extraction
			const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

			const response = await fetch(proxyUrl);
			if (!response.ok) {
				throw new Error("Proxy request failed");
			}

			const html = await response.text();

			// Extract basic metadata
			const title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || "Unknown";
			const description =
				html.match(
					/<meta[^>]*name="description"[^>]*content="([^"]*)"/i,
				)?.[1] || "";

			return { title, description };
		} catch (error) {
			console.warn("Metadata extraction failed:", error);
			return { title: "Unknown", description: "" };
		}
	}

	/**
	 * Create response from oEmbed data
	 */
	private createResponseFromOEmbed(
		oembedData: {
			title?: string;
			html?: string;
			author_name?: string;
			author_url?: string;
			thumbnail_url?: string;
		},
		url: string,
		platform: SupportedPlatform,
	): DownloadResponse {
		const results: DownloadResult[] = [];

		if (oembedData.html) {
			// Extract media URLs from oEmbed HTML
			const mediaUrls = this.extractMediaUrlsFromHTML(oembedData.html);

			mediaUrls.forEach((mediaUrl, index) => {
				results.push({
					id: `${platform}-${Date.now()}-${index}`,
					type: mediaUrl.includes(".mp4") ? "video" : "image",
					url: url,
					thumbnail: mediaUrl,
					downloadUrl: mediaUrl,
					title: oembedData.title || `${platform} Content`,
					size: "Unknown",
					platform: platform,
					quality: "hd",
					isMock: false,
				});
			});
		}

		return {
			success: results.length > 0,
			results,
			platform,
		};
	}

	/**
	 * Create response from extracted metadata
	 */
	private createResponseFromMetadata(
		metadata: {
			title: string;
			description: string;
		},
		url: string,
		platform: SupportedPlatform,
	): DownloadResponse {
		const results: DownloadResult[] = [];

		results.push({
			id: `${platform}-${Date.now()}`,
			type: "video",
			url: url,
			thumbnail: this.generatePlaceholderThumbnail(platform),
			downloadUrl: "#demo-download",
			title: metadata.title || `${platform} Content`,
			size: "Unknown",
			platform: platform,
			quality: "hd",
			isMock: true,
		});

		return {
			success: true,
			results,
			platform,
		};
	}

	/**
	 * Create demo response when real extraction fails
	 */
	private createDemoResponse(
		url: string,
		platform: SupportedPlatform,
		error?: Error | unknown,
	): DownloadResponse {
		console.warn(`${platform} extraction failed, using demo:`, error);

		const results: DownloadResult[] = [
			{
				id: `demo-${platform}-${Date.now()}`,
				type: "video",
				url: url,
				thumbnail: this.generatePlaceholderThumbnail(platform),
				downloadUrl: "#demo-download",
				title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Content (Demo)`,
				size: "Unknown",
				platform: platform,
				quality: "hd",
				isMock: true,
			},
		];

		return {
			success: true,
			results,
			platform,
		};
	}

	/**
	 * Extract media URLs from HTML
	 */
	private extractMediaUrlsFromHTML(html: string): string[] {
		const urls: string[] = [];

		// Extract video URLs
		const videoMatches = html.matchAll(/https:\/\/[^"\s]*\.mp4[^"\s]*/g);
		for (const match of videoMatches) {
			if (!urls.includes(match[0])) {
				urls.push(match[0]);
			}
		}

		// Extract image URLs
		const imageMatches = html.matchAll(
			/https:\/\/[^"\s]*\.(jpg|jpeg|png|webp)[^"\s]*/g,
		);
		for (const match of imageMatches) {
			if (!urls.includes(match[0])) {
				urls.push(match[0]);
			}
		}

		return urls;
	}

	/**
	 * Generate platform-specific placeholder thumbnail
	 */
	private generatePlaceholderThumbnail(platform: SupportedPlatform): string {
		const colors = {
			instagram: "FF69B4",
			tiktok: "000000",
			twitter: "1DA1F2",
		};

		const color = colors[platform] || "1a1a2e";
		return `https://via.placeholder.com/400x300/${color}/FFFFFF?text=${platform.toUpperCase()}+Content`;
	}
}

export const clientDownloadService = ClientDownloadService.getInstance();
