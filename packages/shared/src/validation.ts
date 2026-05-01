import { ALLOWED_PLATFORM_DOMAINS, DANGEROUS_CHARS_REGEX, URL_PATTERNS } from "./constants";
import type { SupportedPlatform, ValidationSchema } from "./types";

/**
 * Validate a URL for safe processing and supported platform check
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
	if (!url || typeof url !== "string") {
		return { valid: false, error: "URL is required" };
	}

	const trimmed = url.trim();

	if (DANGEROUS_CHARS_REGEX.test(trimmed)) {
		return {
			valid: false,
			error: "URL contains invalid characters. Only standard URL characters are allowed.",
		};
	}

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return { valid: false, error: "Invalid URL format" };
	}

	if (!["http:", "https:"].includes(parsed.protocol)) {
		return {
			valid: false,
			error: `Unsupported protocol '${parsed.protocol}'. Only HTTP and HTTPS are allowed.`,
		};
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
	const normalizedUrl = url.toLowerCase().trim();

	for (const [platform, config] of Object.entries(URL_PATTERNS)) {
		if (config.domain.test(normalizedUrl)) {
			return platform as SupportedPlatform;
		}
	}

	if (normalizedUrl.includes("x.com")) {
		return "twitter" as SupportedPlatform;
	}

	return null;
}

/**
 * Extract content ID from platform URL
 */
export function extractContentId(url: string, platform: SupportedPlatform): string | null {
	try {
		// Match against the normalized full URL (href), not just pathname.
		const href = new URL(url).href;
		const patterns = URL_PATTERNS[platform]?.patterns || [];

		for (const pattern of patterns) {
			const match = href.match(pattern);
			if (match?.[1]) {
				return match[1];
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Full validation for frontend use
 */
export function validate(url: string): ValidationSchema {
	const errors: string[] = [];

	if (!url || typeof url !== "string") {
		errors.push("URL is required");
		return { isValid: false, errors };
	}

	const trimmedUrl = url.trim();

	try {
		new URL(trimmedUrl);
	} catch {
		errors.push("Invalid URL format");
		return { isValid: false, errors };
	}

	const urlObj = new URL(trimmedUrl);
	if (!["http:", "https:"].includes(urlObj.protocol)) {
		errors.push("URL must use HTTP or HTTPS protocol");
	}

	const platform = detectPlatform(trimmedUrl);
	if (!platform) {
		errors.push("Unsupported platform. Please use X or TikTok URL");
		return { isValid: false, errors };
	}

	const contentId = extractContentId(trimmedUrl, platform);
	if (!contentId) {
		errors.push(`Could not extract content ID from ${platform} URL`);
		return { isValid: false, errors, platform };
	}

	return {
		isValid: errors.length === 0,
		errors,
		platform,
		contentId,
	};
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
	const NON_RETRYABLE = [
		"invalid url",
		"unsupported platform",
		"url contains",
		"only http and https",
	];
	const errorLower = error.toLowerCase();
	for (const pattern of NON_RETRYABLE) {
		if (errorLower.includes(pattern)) {
			return false;
		}
	}
	return true;
}

/**
 * Parse quality string to quality category.
 * Treats anything ≥720p as HD so 1920p/1280p classify correctly.
 */
export function parseQuality(quality: string): "hd" | "sd" | "audio" {
	const q = quality.toLowerCase();
	if (q.includes("audio")) return "audio";
	if (q === "best" || q === "hd") return "hd";
	const match = q.match(/(\d+)\s*p/);
	if (match && parseInt(match[1], 10) >= 720) return "hd";
	return "sd";
}

/**
 * Format file size from bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
