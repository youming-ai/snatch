import type { SupportedPlatform } from "@/types/download";
import {
	InstagramAdapter,
	type PlatformAdapter,
	TikTokAdapter,
	TwitterAdapter,
} from "../adapters";

/**
 * Registry for managing platform adapters
 */
export class AdapterRegistry {
	private static instance: AdapterRegistry;
	private adapters: Map<SupportedPlatform, PlatformAdapter> = new Map();

	private constructor() {
		this.initializeAdapters();
	}

	static getInstance(): AdapterRegistry {
		if (!AdapterRegistry.instance) {
			AdapterRegistry.instance = new AdapterRegistry();
		}
		return AdapterRegistry.instance;
	}

	/**
	 * Initialize default platform adapters
	 */
	private initializeAdapters(): void {
		this.register(new InstagramAdapter());
		this.register(new TwitterAdapter());
		this.register(new TikTokAdapter());
	}

	/**
	 * Register a new platform adapter
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
	 * Get adapter by detecting platform from URL
	 */
	getAdapterByUrl(url: string): PlatformAdapter | undefined {
		for (const adapter of this.adapters.values()) {
			if (adapter.canHandle(url)) {
				return adapter;
			}
		}
		return undefined;
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
		return Array.from(this.adapters.keys());
	}

	/**
	 * Check if platform is supported
	 */
	isPlatformSupported(platform: SupportedPlatform): boolean {
		return this.adapters.has(platform);
	}

	/**
	 * Check if URL is from a supported platform
	 */
	isUrlSupported(url: string): boolean {
		return this.getAdapterByUrl(url) !== undefined;
	}
}

// Export singleton instance
export const adapterRegistry = AdapterRegistry.getInstance();
