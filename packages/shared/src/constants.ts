/**
 * Every service the yt-dlp engine can fetch, its display label, and the
 * host(s) whose URLs we accept. yt-dlp does the real extraction — snatch
 * only gates on a known host, so this list is the single source of truth for
 * both URL validation and the UI's "supported services" grid.
 */
export const SERVICES = [
	{ id: "bilibili", label: "bilibili", hosts: ["bilibili.com", "b23.tv"] },
	{ id: "bluesky", label: "Bluesky", hosts: ["bsky.app"] },
	{ id: "dailymotion", label: "Dailymotion", hosts: ["dailymotion.com", "dai.ly"] },
	{ id: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.watch"] },
	{ id: "instagram", label: "Instagram", hosts: ["instagram.com"] },
	{ id: "loom", label: "Loom", hosts: ["loom.com"] },
	{ id: "ok", label: "OK.ru", hosts: ["ok.ru"] },
	{ id: "pinterest", label: "Pinterest", hosts: ["pinterest.com", "pin.it"] },
	{ id: "newgrounds", label: "Newgrounds", hosts: ["newgrounds.com"] },
	{ id: "reddit", label: "Reddit", hosts: ["reddit.com", "redd.it"] },
	{ id: "rutube", label: "Rutube", hosts: ["rutube.ru"] },
	{ id: "snapchat", label: "Snapchat", hosts: ["snapchat.com"] },
	{ id: "soundcloud", label: "SoundCloud", hosts: ["soundcloud.com"] },
	{ id: "streamable", label: "Streamable", hosts: ["streamable.com"] },
	{ id: "tiktok", label: "TikTok", hosts: ["tiktok.com"] },
	{ id: "tumblr", label: "Tumblr", hosts: ["tumblr.com"] },
	{ id: "twitch", label: "Twitch Clips", hosts: ["twitch.tv", "clips.twitch.tv"] },
	{ id: "twitter", label: "X / Twitter", hosts: ["x.com", "twitter.com"] },
	{ id: "vimeo", label: "Vimeo", hosts: ["vimeo.com"] },
	{ id: "vk", label: "VK", hosts: ["vk.com", "vkvideo.ru"] },
	{ id: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
] as const;

export type SupportedPlatform = (typeof SERVICES)[number]["id"];

export const PLATFORM_HOSTS = Object.fromEntries(
	SERVICES.map((s) => [s.id, [...s.hosts]] as const),
) as unknown as Record<SupportedPlatform, string[]>;

export const ALLOWED_PLATFORM_DOMAINS = SERVICES.flatMap((s) => [...s.hosts]);

// Real share URLs never contain whitespace. `new URL()` parsing + the host
// allowlist do the actual security work; this just rejects malformed input.
export const WHITESPACE_ONLY_REGEX = /\s/;

export const NON_RETRYABLE_PATTERNS = [
	"invalid url",
	"unsupported platform",
	"url contains",
	"only http and https",
];
