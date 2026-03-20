import type { PlatformConfig, SupportedPlatform } from "@/types/download";

/**
 * Platform configurations and constants
 */
export const SUPPORTED_PLATFORMS = {
	INSTAGRAM: "instagram",
	TWITTER: "twitter",
	TIKTOK: "tiktok",
} as const;

export const PLATFORM_CONFIGS: Record<SupportedPlatform, PlatformConfig> = {
	[SUPPORTED_PLATFORMS.INSTAGRAM]: {
		domain: "instagram.com",
		name: "Instagram",
		color: "text-pink-500",
		bgColor: "bg-pink-500/10",
		description: "Reels, Videos, Photos",
		supportedMedia: ["video", "image"],
	},
	[SUPPORTED_PLATFORMS.TWITTER]: {
		domain: "twitter.com",
		name: "X (Twitter)",
		color: "text-blue-400",
		bgColor: "bg-blue-400/10",
		description: "Videos, GIFs",
		supportedMedia: ["video"],
	},
	[SUPPORTED_PLATFORMS.TIKTOK]: {
		domain: "tiktok.com",
		name: "TikTok",
		color: "text-black dark:text-white",
		bgColor: "bg-gray-500/10",
		description: "No Watermark Videos",
		supportedMedia: ["video"],
	},
};

export const PLATFORM_DOMAINS = Object.values(PLATFORM_CONFIGS).map(
	(config) => config.domain,
);

/**
 * URL patterns for platform detection and ID extraction
 */
export const URL_PATTERNS = {
	instagram: {
		domain: /instagram\.com/i,
		patterns: [
			/\/reel\/([A-Za-z0-9_-]+)/i,
			/\/p\/([A-Za-z0-9_-]+)/i,
			/\/tv\/([A-Za-z0-9_-]+)/i,
		],
	},
	twitter: {
		domain: /(?:x\.com|twitter\.com)/i,
		patterns: [/\/status\/(\d+)/i],
	},
	tiktok: {
		domain: /tiktok\.com/i,
		patterns: [/\/video\/(\d+)/i, /\/@[^/]+\/video\/(\d+)/i],
	},
} as const;
