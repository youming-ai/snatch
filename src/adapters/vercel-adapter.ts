import type { DownloadResult, SupportedPlatform } from "@/types/download";

/**
 * Vercel-optimized adapter for social media download
 * Uses lightweight methods suitable for serverless functions
 */
export class VercelAdapter {
	private readonly platform: SupportedPlatform;
	private readonly name: string;
	private readonly patterns: RegExp[];

	constructor(platform: SupportedPlatform, name: string, patterns: RegExp[]) {
		this.platform = platform;
		this.name = name;
		this.patterns = patterns;
	}

	canHandle(url: string): boolean {
		return this.patterns.some((pattern) => pattern.test(url));
	}

	async download(url: string): Promise<DownloadResult[]> {
		console.log(`🔄 [Vercel-${this.platform}] Processing download for:`, url);

		try {
			const results = await this.extractContent(url);

			console.log(
				`✅ [Vercel-${this.platform}] Found ${results.length} results`,
			);
			return results;
		} catch (error) {
			console.error(`❌ [Vercel-${this.platform}] Error:`, error);
			throw new Error(
				`Failed to download from ${this.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Extract content using lightweight methods suitable for serverless
	 */
	private async extractContent(url: string): Promise<DownloadResult[]> {
		const contentId = this.extractId(url);

		if (!contentId) {
			throw new Error(`Invalid ${this.name} URL format`);
		}

		// Method 1: Try oEmbed API
		try {
			const oembedResults = await this.tryOEmbed(url);
			if (oembedResults.length > 0) {
				return oembedResults;
			}
		} catch (error) {
			console.warn(`[${this.name}] OEmbed failed:`, error);
		}

		// Method 2: Try metadata extraction
		try {
			const metadataResults = await this.extractMetadata(url, contentId);
			if (metadataResults.length > 0) {
				return metadataResults;
			}
		} catch (error) {
			console.warn(`[${this.name}] Metadata extraction failed:`, error);
		}

		// Method 3: Return demo result
		return [this.createDemoResult(url, contentId)];
	}

	/**
	 * Try oEmbed API
	 */
	private async tryOEmbed(url: string): Promise<DownloadResult[]> {
		const oembedUrl = this.getOEmbedUrl(url);

		const response = await fetch(oembedUrl, {
			headers: {
				Accept: "application/json",
				"User-Agent": "Mozilla/5.0 (compatible; Vercel)",
			},
		});

		if (!response.ok) {
			throw new Error(`OEmbed API failed: ${response.status}`);
		}

		const data = await response.json();

		if (!data.html) {
			return [];
		}

		return this.parseOEmbedResponse(data, url);
	}

	/**
	 * Parse oEmbed response
	 */
	private parseOEmbedResponse(
		data: any,
		originalUrl: string,
	): DownloadResult[] {
		const results: DownloadResult[] = [];

		const mediaUrls = this.extractMediaUrls(data.html);

		return mediaUrls.map((mediaUrl, index) => ({
			id: `${this.platform}-${Date.now()}-${index}`,
			type: this.detectMediaType(mediaUrl),
			url: originalUrl,
			thumbnail: mediaUrl,
			downloadUrl: mediaUrl,
			title: data.title || `${this.name} Content`,
			size: this.estimateSize(mediaUrl),
			platform: this.platform,
			quality: this.detectQuality(mediaUrl),
		}));
	}

	/**
	 * Extract metadata using web scraping
	 */
	private async extractMetadata(
		url: string,
		contentId: string,
	): Promise<DownloadResult[]> {
		try {
			// Use a reliable proxy service
			const proxyUrl = this.getProxyUrl(url);
			const response = await fetch(proxyUrl, {
				headers: {
					Accept: "application/json",
					"User-Agent": "Mozilla/5.0 (compatible; Vercel)",
				},
			});

			if (!response.ok) {
				return [];
			}

			const data = await response.json();

			const title = data.title || `${this.name} Content`;

			return [
				{
					id: `${this.platform}-metadata-${Date.now()}`,
					type: "video",
					url: url,
					thumbnail: this.generateThumbnail(),
					downloadUrl: "#demo-download",
					title,
					size: "Unknown",
					platform: this.platform,
					quality: "unknown",
					isMock: true,
				},
			];
		} catch (error) {
			console.warn(`[${this.name}] Metadata extraction failed:`, error);
			return [];
		}
	}

	/**
	 * Create demo result for when extraction fails
	 */
	private createDemoResult(url: string, contentId: string): DownloadResult {
		return {
			id: `demo-${this.platform}-${Date.now()}`,
			type: "video",
			url: url,
			thumbnail: this.generateThumbnail(),
			downloadUrl: "#demo-download",
			title: `${this.name} Content (Demo)`,
			size: "Unknown",
			platform: this.platform,
			quality: "unknown",
			isMock: true,
			message: `This is a demo response. Real ${this.name} downloads require a server environment with specialized access.`,
		};
	}

	/**
	 * Extract content ID from URL
	 */
	extractId(url: string): string | null {
		try {
			const urlObj = new URL(url);

			for (const pattern of this.patterns) {
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

	/**
	 * Get oEmbed URL for the platform
	 */
	private getOEmbedUrl(url: string): string {
		switch (this.platform) {
			case "instagram":
				return `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}&format=json&maxwidth=640`;
			case "twitter":
				return `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
			default:
				return "";
		}
	}

	/**
	 * Get proxy URL for metadata extraction
	 */
	private getProxyUrl(url: string): string {
		// Use a reliable proxy service
		return `https://r.jina.ai/http://${encodeURIComponent(url.substring(8))}`;
	}

	/**
	 * Extract media URLs from HTML content
	 */
	private extractMediaUrlsFromHTML(html: string): string[] {
		const urls: string[] = [];

		const mediaTypes = ["mp4", "jpg", "jpeg", "png", "webp"];

		for (const type of mediaTypes) {
			const regex = new RegExp(`https://[^\\s]*\\.${type}[^\\s]*`, "g");
			const matches = html.matchAll(regex);

			for (const match of matches) {
				if (!urls.includes(match[0])) {
					urls.push(match[0]);
				}
			}
		}

		return urls;
	}

	/**
	 * Detect media type from URL
	 */
	private detectMediaType(url: string): "video" | "image" {
		return url.includes(".mp4") ? "video" : "image";
	}

	/**
	 * Detect video quality from URL
	 */
	private detectQuality(url: string): string {
		if (url.includes("/HD.") || url.includes("_hd")) return "hd";
		if (url.includes("/SD.") || url.includes("_sd")) return "sd";
		return "unknown";
	}

	/**
	 * Estimate file size from URL
	 */
	private estimateSize(url: string): string {
		// Basic size estimation
		if (url.includes(".mp4")) {
			return "2-5 MB";
		} else if (url.includes(".jpg") || url.includes(".jpeg")) {
			return "500KB-2MB";
		}
		return "Unknown";
	}

	/**
	 * Generate placeholder thumbnail
	 */
	private generateThumbnail(): string {
		const colors = {
			instagram: "FF69B4",
			tiktok: "000000",
			twitter: "1DA1F2",
		};

		const color = colors[this.platform] || "1a1a2e";
		return `https://via.placeholder.com/400x300/${color}/FFFFFF?text=${this.platform.toUpperCase()}+Content`;
	}
}

/**
 * Factory to create platform-specific Vercel adapters
 */
export function createVercelAdapter(
	platform: SupportedPlatform,
): VercelAdapter {
	switch (platform) {
		case "instagram":
			return new VercelAdapter(platform, "Instagram", [
				/\/reel\/([A-Za-z0-9_-]+)/i,
				/\/p\/([A-Za-z0-9_-]+)/i,
				/\/tv\/([A-Za-z0-9_-]+)/i,
			]);
		case "tiktok":
			return new VercelAdapter(platform, "TikTok", [
				/\/video\/(\d+)/i,
				/\/@[^/]+\/video\/(\d+)/i,
			]);
		case "twitter":
			return new VercelAdapter(platform, "X (Twitter)", [/\/status\/(\d+)/i]);
		default:
			throw new Error(`Unsupported platform: ${platform}`);
	}
}
