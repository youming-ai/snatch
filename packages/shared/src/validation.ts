import {
	ALLOWED_PLATFORM_DOMAINS,
	PLATFORM_HOSTS,
	type SupportedPlatform,
	WHITESPACE_ONLY_REGEX,
} from "./constants";

function parseHttpUrl(url: string): URL | null {
	try {
		const parsed = new URL(url.trim());
		return ["http:", "https:"].includes(parsed.protocol) ? parsed : null;
	} catch {
		return null;
	}
}

function hostMatchesDomain(host: string, domain: string): boolean {
	return host === domain || host.endsWith(`.${domain}`);
}

function platformFromHost(host: string): SupportedPlatform | null {
	for (const [platform, domains] of Object.entries(PLATFORM_HOSTS)) {
		if (domains.some((domain) => hostMatchesDomain(host, domain))) {
			return platform as SupportedPlatform;
		}
	}
	return null;
}

/**
 * Validate a URL for safe processing and supported platform check
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
	if (!url || typeof url !== "string") {
		return { valid: false, error: "URL is required" };
	}

	const trimmed = url.trim();

	if (WHITESPACE_ONLY_REGEX.test(trimmed)) {
		return {
			valid: false,
			error: "URL contains invalid characters. Only standard URL characters are allowed.",
		};
	}

	const parsed = parseHttpUrl(trimmed);
	if (!parsed) {
		return { valid: false, error: "Invalid URL format" };
	}

	const host = parsed.hostname.toLowerCase();
	const isAllowed = ALLOWED_PLATFORM_DOMAINS.some(
		(domain) => host === domain || host.endsWith(`.${domain}`),
	);

	if (!isAllowed) {
		return {
			valid: false,
			error: `Unsupported platform: '${host}'. Supported: ${ALLOWED_PLATFORM_DOMAINS.join(", ")}`,
		};
	}

	return { valid: true };
}

/**
 * Detect platform from URL
 */
export function detectPlatform(url: string): SupportedPlatform | null {
	const parsed = parseHttpUrl(url);
	if (!parsed) return null;
	return platformFromHost(parsed.hostname.toLowerCase());
}
