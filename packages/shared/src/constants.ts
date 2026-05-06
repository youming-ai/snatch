import type { PlatformConfig, SupportedPlatform } from "./types";

export const SUPPORTED_PLATFORMS = {
	TWITTER: "twitter",
	TIKTOK: "tiktok",
} as const;

export const PLATFORM_HOSTS: Record<SupportedPlatform, string[]> = {
	[SUPPORTED_PLATFORMS.TWITTER]: ["x.com", "twitter.com"],
	[SUPPORTED_PLATFORMS.TIKTOK]: ["tiktok.com"],
};

export const PLATFORM_CONFIGS: Record<SupportedPlatform, PlatformConfig> = {
	[SUPPORTED_PLATFORMS.TWITTER]: {
		domain: "x.com",
		name: "X",
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

export const PLATFORM_DOMAINS = Object.values(PLATFORM_HOSTS).flat();

export const URL_PATTERNS = {
	twitter: {
		patterns: [/\/status\/(\d+)/i],
		requiresContentId: true,
	},
	tiktok: {
		patterns: [/\/video\/(\d+)/i, /\/@[^/]+\/video\/(\d+)/i],
		requiresContentId: false,
	},
} as const;

export const ALLOWED_PLATFORM_DOMAINS = PLATFORM_DOMAINS;

// Real share URLs never contain whitespace. We spawn yt-dlp via argv (no
// shell), so shell metacharacters like `&;|$\`` cannot inject commands and
// don't need to be filtered here — `new URL()` parsing + the platform domain
// whitelist do the actual security work.
export const WHITESPACE_ONLY_REGEX = /\s/;

export const DANGEROUS_PROTOCOLS = ["javascript:", "data:", "vbscript:", "file:", "ftp:"] as const;

export const NON_RETRYABLE_PATTERNS = [
	"invalid url",
	"unsupported platform",
	"url contains",
	"only http and https",
];
