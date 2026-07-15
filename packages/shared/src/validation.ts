import {
	ALLOWED_PLATFORM_DOMAINS,
	NON_RETRYABLE_PATTERNS,
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

/**
 * Sanitize URL for safe processing
 */
export function sanitizeUrl(url: string): string {
	const trimmedUrl = url.trim();

	const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:", "ftp:"];
	const lowerUrl = trimmedUrl.toLowerCase();
	for (const protocol of dangerousProtocols) {
		if (lowerUrl.startsWith(protocol)) {
			throw new Error("Dangerous protocol detected");
		}
	}

	const xssPatterns = [
		/<script/i,
		/<iframe/i,
		/<embed/i,
		/<object/i,
		/onload=/i,
		/onerror=/i,
		/onclick=/i,
		/onmouseover=/i,
		/javascript:/i,
		/fromcharcode/i,
		/innerHTML/i,
		/outerHTML/i,
		/eval\(/i,
		/expression\(/i,
	];
	for (const pattern of xssPatterns) {
		if (pattern.test(trimmedUrl)) {
			throw new Error("XSS pattern detected");
		}
	}

	const urlObj = new URL(trimmedUrl);
	if (!["http:", "https:"].includes(urlObj.protocol)) {
		throw new Error("Unsupported protocol detected");
	}

	const dangerousParams = [
		"callback",
		"jsonp",
		"redirect",
		"return",
		"next",
		"url",
		"dest",
		"destination",
		"redirect_uri",
		"redirect_url",
		"return_to",
		"load",
		"src",
		"eval",
		"exec",
		"cmd",
		"command",
	];

	const safeParams = new URLSearchParams();
	for (const [key, value] of urlObj.searchParams.entries()) {
		if (!dangerousParams.includes(key.toLowerCase())) {
			safeParams.append(key, value);
		}
	}

	const safeUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
	const queryString = safeParams.toString();
	return queryString ? `${safeUrl}?${queryString}` : safeUrl;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: string): boolean {
	const errorLower = error.toLowerCase();
	for (const pattern of NON_RETRYABLE_PATTERNS) {
		if (errorLower.includes(pattern)) {
			return false;
		}
	}
	return true;
}
