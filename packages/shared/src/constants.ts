import type { PlatformConfig, SupportedPlatform } from "./types";

export const SUPPORTED_PLATFORMS = {
	TWITTER: "twitter",
	TIKTOK: "tiktok",
	YOUTUBE: "youtube",
} as const;

export const PLATFORM_CONFIGS: Record<SupportedPlatform, PlatformConfig> = {
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
	[SUPPORTED_PLATFORMS.YOUTUBE]: {
		domain: "youtube.com",
		name: "YouTube",
		color: "text-red-500",
		bgColor: "bg-red-500/10",
		description: "Videos & Shorts",
		supportedMedia: ["video"],
	},
};

export const PLATFORM_DOMAINS = Object.values(PLATFORM_CONFIGS).map((config) => config.domain);

export const URL_PATTERNS = {
	twitter: {
		domain: /(?:x\.com|twitter\.com)/i,
		patterns: [/\/status\/(\d+)/i],
	},
	tiktok: {
		domain: /tiktok\.com/i,
		patterns: [/\/video\/(\d+)/i, /\/@[^/]+\/video\/(\d+)/i],
	},
	youtube: {
		domain: /(?:youtube\.com|youtu\.be)/i,
		patterns: [
			/[?&]v=([A-Za-z0-9_-]{11})/i,
			/\/shorts\/([A-Za-z0-9_-]{11})/i,
			/youtu\.be\/([A-Za-z0-9_-]{11})/i,
		],
	},
} as const;

export const ALLOWED_PLATFORM_DOMAINS = [
	"tiktok.com",
	"twitter.com",
	"x.com",
	"youtube.com",
	"youtu.be",
];

// Real share URLs never contain whitespace. We spawn yt-dlp via argv (no
// shell), so shell metacharacters like `&;|$\`` cannot inject commands and
// don't need to be filtered here — `new URL()` parsing + the platform domain
// whitelist do the actual security work.
export const DANGEROUS_CHARS_REGEX = /\s/;

export const DANGEROUS_PROTOCOLS = ["javascript:", "data:", "vbscript:", "file:", "ftp:"];

export const NON_RETRYABLE_PATTERNS = [
	"invalid url",
	"unsupported platform",
	"url contains",
	"only http and https",
];
