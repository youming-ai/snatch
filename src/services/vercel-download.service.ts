import { createVercelAdapter } from "@/adapters/vercel-adapter";
import type { DownloadResponse, SupportedPlatform } from "@/types/download";

/**
 * Vercel-optimized download service
 * Uses lightweight adapters suitable for serverless functions
 */
export class VercelDownloadService {
	private static instance: VercelDownloadService;

	private constructor() {}

	static getInstance(): VercelDownloadService {
		if (!VercelDownloadService.instance) {
			VercelDownloadService.instance = new VercelDownloadService();
		}
		return VercelDownloadService.instance;
	}

	/**
	 * Detect platform from URL
	 */
	detectPlatform(url: string): SupportedPlatform | null {
		const lowercaseUrl = url.toLowerCase();

		if (lowercaseUrl.includes("instagram.com")) return "instagram";
		if (lowercaseUrl.includes("tiktok.com")) return "tiktok";
		if (lowercaseUrl.includes("x.com") || lowercaseUrl.includes("twitter.com"))
			return "twitter";

		return null;
	}

	/**
	 * Main download method optimized for Vercel
	 */
	async download(url: string): Promise<DownloadResponse> {
		try {
			const platform = this.detectPlatform(url);

			if (!platform) {
				return {
					success: false,
					error:
						"Unsupported platform. Please enter Instagram, TikTok, or X (Twitter) URL",
				};
			}

			console.log(`🔄 [Vercel] Starting download for ${platform}:`, url);

			// Use Vercel-optimized adapter
			const adapter = createVercelAdapter(platform);
			const results = await adapter.download(url);

			console.log(
				`✅ [Vercel] Download completed for ${platform}:`,
				results.length,
				"items",
			);

			return {
				success: results.length > 0,
				results,
				platform,
				message: results.some((r) => r.isMock)
					? `This is a demo response. Full ${platform} functionality requires a server environment.`
					: undefined,
			};
		} catch (error) {
			console.error("Vercel download error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Download failed",
			};
		}
	}

	/**
	 * Get platform-specific adapter
	 */
	getAdapter(platform: SupportedPlatform) {
		return createVercelAdapter(platform);
	}
}

export const vercelDownloadService = VercelDownloadService.getInstance();
