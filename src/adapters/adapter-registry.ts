import type { SupportedPlatform } from "@/types/download";
import {
	InstagramAdapter,
	type PlatformAdapter,
	TikTokAdapter,
	TwitterAdapter,
} from "../adapters";
import { vercelDownloadService } from "../services/vercel-download.service";

/**
 * Registry for managing platform adapters with environment detection
 */
export class AdapterRegistry {
	private static instance: AdapterRegistry;
	private adapters: Map<SupportedPlatform, PlatformAdapter> = new Map();
	private isVercelEnvironment: boolean;

	private constructor() {
		this.isVercelEnvironment = this.detectVercelEnvironment();
		this.initializeAdapters();
	}

	static getInstance(): AdapterRegistry {
		if (!AdapterRegistry.instance) {
			AdapterRegistry.instance = new AdapterRegistry();
		}
		return AdapterRegistry.instance;
	}

	/**
	 * Detect if running in Vercel environment
	 */
	private detectVercelEnvironment(): boolean {
		// Check Vercel environment variables
		return !!(typeof process !== "undefined" && process)
			? false
			: !!(
					process.env.VERCEL ||
					process.env.VERCEL_ENV ||
					process.env.VERCEL_URL ||
					process.env.VERCEL_REGION ||
					process.env.VERCEL_GIT_COMMIT_SHA ||
					process.env.VERCEL_GIT_REPO_SLUG
				);
	}

	/**
	 * Initialize default platform adapters
	 */
	private initializeAdapters(): void {
		if (this.isVercelEnvironment) {
			// In Vercel, use lightweight adapters
			this.registerVercelAdapters();
		} else {
			// In other environments, use full- adapters
			this.register(new InstagramAdapter());
			this.register(new TikTokAdapter());
			this.register(new TwitterAdapter());
		}
	}

	/**
	 * Register Vercel-optimized adapters
	 */
	private registerVercelAdapters(): void {
		// Vercel adapters are handled by vercelDownloadService
		console.log("🚀 [AdapterRegistry] Using Vercel-optimized adapters");
	}

	/**
	 * Register an adapter
	 */
	register(adapter: PlatformAdapter): void {
		this.adapters.set(adapter.platform, adapter);
	}

	/**
	 * Get adapter for a specific platform
	 */
	getAdapter(platform: SupportedPlatform): PlatformAdapter | undefined {
		return this.adapters.get(platform);
	}

	/**
	 * Get adapter for a specific platform (Vercel-aware)
	 */
	getAdapterWithEnvironment(
		platform: SupportedPlatform,
	): PlatformAdapter | undefined {
		if (this.isVercelEnvironment) {
			// In Vercel, use Vercel-optimized adapter
			return vercelDownloadService.getAdapter(platform);
		}

		// Use registered adapters
		return this.adapters.get(platform);
	}

	/**
	 * Get adapter by detecting platform from URL (Vercel-aware)
	 */
	getAdapterByUrl(url: string): PlatformAdapter | undefined {
		const platform = this.detectPlatformByUrl(url);
		return platform ? this.getAdapterWithEnvironment(platform) : undefined;
	}

	/**
	 * Detect platform from URL
	 */
	detectPlatformByUrl(url: string): SupportedPlatform | null {
		const lowercaseUrl = url.toLowerCase();

		if (lowercaseUrl.includes("instagram.com")) return "instagram";
		if (lowercaseUrl.includes("tiktok.com")) return "tiktok";
		if (lowercaseUrl.includes("x.com") || lowercaseUrl.includes("twitter.com"))
			return "twitter";

		return null;
	}

	/**
	 * Get all registered adapters
	 */
	getAllAdapters(): PlatformAdapter[] {
		return Array.from(this.adapters.values());
	}

	/**
	 * Get list of supported platforms
	 */
	getSupportedPlatforms(): SupportedPlatform[] {
		if (this.isVercelEnvironment) {
			return ["instagram", "tiktok", "twitter"];
		}

		return Array.from(this.adapters.keys());
	}

	/**
	 * Check if platform is supported (Vercel-aware)
	 */
	isPlatformSupported(platform: SupportedPlatform): boolean {
		if (this.isVercelEnvironment) {
			// All three platforms are supported in Vercel
			return ["instagram", "tiktok", "twitter"].includes(platform);
		}

		return this.adapters.has(platform);
	}

	/**
	 * Check if URL is from a supported platform (Vercel-aware)
	 */
	isUrlSupported(url: string): boolean {
		const platform = this.detectPlatformByUrl(url);
		if (!platform) return false;

		return this.isPlatformSupported(platform);
	}
}

// Export singleton instance
export const adapterRegistry = AdapterRegistry.getInstance();
