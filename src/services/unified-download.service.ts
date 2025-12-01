import { getPlatformConfig as getEnvPlatformConfig } from "@/config/platform-config";
import { adapterRegistry } from "@/lib/adapters/adapter-registry";
import { detectPlatform, validate } from "@/lib/validation";
import type {
	DownloadResponse,
	DownloadResult,
	SupportedPlatform,
} from "@/types/download";

/**
 * Unified download service with security, validation, and error handling
 */
export class UnifiedDownloadService {
	private static instance: UnifiedDownloadService;

	private constructor() {}

	static getInstance(): UnifiedDownloadService {
		if (!UnifiedDownloadService.instance) {
			UnifiedDownloadService.instance = new UnifiedDownloadService();
		}
		return UnifiedDownloadService.instance;
	}

	/**
	 * Download content from URL with full validation and error handling
	 */
	async download(url: string): Promise<DownloadResponse> {
		try {
			// Step 1: Validate and sanitize URL
			const validation = validate(url);
			if (!validation.isValid) {
				return {
					success: false,
					error: validation.errors.join(", "),
					platform: validation.platform,
				};
			}

			if (!validation.platform || !validation.contentId) {
				return {
					success: false,
					error: "Could not determine platform or extract content ID",
				};
			}

			// Step 2: Get appropriate adapter
			const adapter = adapterRegistry.getAdapter(validation.platform);
			if (!adapter) {
				return {
					success: false,
					error: `No adapter available for platform: ${validation.platform}`,
					platform: validation.platform,
				};
			}

			// Step 3: Execute download with timeout
			const downloadStartTime = Date.now();
			const results = await this.executeWithTimeout(
				() => adapter.download(url),
				30000, // 30 second timeout
				`Download timeout for ${validation.platform}`,
			);
			const downloadDuration = Date.now() - downloadStartTime;

			// Step 4: Validate and sanitize results
			const sanitizedResults = this.sanitizeResults(results);

			// Step 5: Log download completion
			console.log(
				`[Crawlee] ${validation.platform} download completed successfully in ${downloadDuration}ms`,
			);

			return {
				success: true,
				results: sanitizedResults,
				platform: validation.platform,
				processingTime: downloadDuration,
			};
		} catch (error) {
			return this.handleError(error, url);
		}
	}

	/**
	 * Execute function with timeout and CORS handling
	 */
	private async executeWithTimeout<T>(
		fn: () => Promise<T>,
		timeoutMs: number,
		timeoutMessage: string,
	): Promise<T> {
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
		});

		try {
			return await Promise.race([fn(), timeoutPromise]);
		} catch (error) {
			// Handle CORS errors specifically
			if (error instanceof Error && error.message.includes("CORS")) {
				throw new Error(
					"Unable to connect to download service due to browser security restrictions. Please try again or use a different URL.",
				);
			}
			throw error;
		}
	}

	/**
	 * Sanitize and validate download results
	 */
	private sanitizeResults(results: DownloadResult[]): DownloadResult[] {
		return results
			.filter((result, index, self) => {
				// Remove duplicates
				const isDuplicate = self.findIndex((r) => r.id === result.id) < index;
				if (isDuplicate) return false;

				// Validate required fields
				return !!(
					result.id &&
					result.type &&
					result.platform &&
					result.downloadUrl &&
					this.isValidUrl(result.downloadUrl)
				);
			})
			.map((result) => ({
				...result,
				title: this.sanitizeTitle(result.title),
				thumbnail:
					result.thumbnail || this.generateFallbackThumbnail(result.platform),
				isMock: result.isMock,
				isFallback: result.isFallback || false, // Ensure isFallback is boolean
			}));
	}

	/**
	 * Sanitize title for safe display
	 */
	private sanitizeTitle(title: string): string {
		if (!title) return "Untitled Content";

		return (
			title
				.replace(/[<>]/g, "") // Remove potential HTML tags
				.substring(0, 200) // Limit length
				.trim() || "Untitled Content"
		);
	}

	/**
	 * Generate fallback thumbnail URL
	 */
	private generateFallbackThumbnail(platform: SupportedPlatform): string {
		const config = getEnvPlatformConfig(platform);
		return `https://via.placeholder.com/400x300/1a1a2e/16213e?text=${encodeURIComponent(config.name)}+Content`;
	}

	/**
	 * Validate URL format
	 */
	private isValidUrl(url: string): boolean {
		try {
			const urlObj = new URL(url);
			return ["http:", "https:"].includes(urlObj.protocol);
		} catch {
			return false;
		}
	}

	/**
	 * Handle and format errors
	 */
	private handleError(error: unknown, url: string): DownloadResponse {
		console.error("Download service error:", {
			error: error instanceof Error ? error.message : "Unknown error",
			url,
			stack: error instanceof Error ? error.stack : undefined,
			timestamp: new Date().toISOString(),
		});

		const errorMap: Record<string, string> = {
			ENOTFOUND: "Network connection failed",
			ECONNREFUSED: "Connection refused",
			ETIMEDOUT: "Request timed out",
			"Download timeout": "Download request timed out",
		};

		let errorMessage = "An unexpected error occurred";

		if (error instanceof Error) {
			errorMessage = errorMap[error.message] || error.message;
		}

		return {
			success: false,
			error: errorMessage,
		};
	}

	/**
	 * Get platform configuration
	 */
	getPlatformConfig(platform: SupportedPlatform) {
		return getEnvPlatformConfig(platform);
	}

	/**
	 * Get all supported platforms
	 */
	getSupportedPlatforms(): SupportedPlatform[] {
		return adapterRegistry.getSupportedPlatforms();
	}

	/**
	 * Detect platform from URL
	 */
	detectPlatform(url: string): SupportedPlatform | null {
		return detectPlatform(url);
	}

	/**
	 * Validate URL without downloading
	 */
	validateUrl(url: string) {
		return validate(url);
	}
}

// Export singleton instance
export const downloadService = UnifiedDownloadService.getInstance();
