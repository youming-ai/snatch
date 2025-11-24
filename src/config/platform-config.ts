import type { PlatformConfig, SupportedPlatform } from "@/types/download";
import { getConfig } from "./env";

/**
 * Platform-specific configuration with environment overrides
 */
export const getPlatformConfig = (
	platform: SupportedPlatform,
): PlatformConfig => {
	const envConfig = getConfig();

	const baseConfigs: Record<SupportedPlatform, PlatformConfig> = {
		instagram: {
			domain: "instagram.com",
			name: "Instagram",
			color: "text-pink-500",
			bgColor: "bg-pink-500/10",
			description: "Reels, Videos, Photos",
			supportedMedia: ["video", "image"],
		},
		twitter: {
			domain: "x.com", // Updated to reflect current branding
			name: "X (Twitter)",
			color: "text-blue-400",
			bgColor: "bg-blue-400/10",
			description: "Videos, GIFs",
			supportedMedia: ["video"],
		},
		tiktok: {
			domain: "tiktok.com",
			name: "TikTok",
			color: "text-black dark:text-white",
			bgColor: "bg-gray-500/10",
			description: "No Watermark Videos",
			supportedMedia: ["video"],
		},
	};

	const baseConfig = baseConfigs[platform];

	// Apply environment-specific modifications
	if (envConfig.mockDownloads) {
		baseConfig.description += " (Demo Mode)";
	}

	return baseConfig;
};

/**
 * Get all platform configurations
 */
export const getAllPlatformConfigs = (): Record<
	SupportedPlatform,
	PlatformConfig
> => {
	const platforms: SupportedPlatform[] = ["instagram", "twitter", "tiktok"];
	return platforms.reduce(
		(acc, platform) => {
			acc[platform] = getPlatformConfig(platform);
			return acc;
		},
		{} as Record<SupportedPlatform, PlatformConfig>,
	);
};

/**
 * Platform feature flags based on environment
 */
export const getPlatformFeatures = (platform: SupportedPlatform) => {
	const envConfig = getConfig();

	return {
		allowHighQuality: envConfig.defaultDownloadQuality === "hd",
		enableWatermarkRemoval: platform === "tiktok" && envConfig.mockDownloads,
		enableCorsProxy: envConfig.enableCorsProxy,
		maxFileSize: envConfig.maxFileSize,
		supportedFormats: envConfig.supportedFormats,
	};
};
