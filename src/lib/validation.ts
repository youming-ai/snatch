import { SUPPORTED_PLATFORMS, URL_PATTERNS } from "@/constants/platforms";
import type { SupportedPlatform, ValidationSchema } from "@/types/download";

/**
 * Secure URL validation and platform detection functions
 */

/**
 * Validates and sanitizes a URL
 */
export function validate(url: string): ValidationSchema {
	const errors: string[] = [];

	// Basic URL validation
	if (!url || typeof url !== "string") {
		errors.push("URL is required");
		return { isValid: false, errors };
	}

	const trimmedUrl = url.trim();

	// Check URL format
	try {
		new URL(trimmedUrl);
	} catch {
		errors.push("Invalid URL format");
		return { isValid: false, errors };
	}

	// Check protocol
	const urlObj = new URL(trimmedUrl);
	if (!["http:", "https:"].includes(urlObj.protocol)) {
		errors.push("URL must use HTTP or HTTPS protocol");
	}

	// Detect platform
	const platform = detectPlatform(trimmedUrl);
	if (!platform) {
		errors.push(
			"Unsupported platform. Please use Instagram, X (Twitter), or TikTok URL",
		);
		return { isValid: false, errors };
	}

	// Extract content ID
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
 * Detects the platform from URL
 */
export function detectPlatform(url: string): SupportedPlatform | null {
	const normalizedUrl = url.toLowerCase().trim();

	for (const [platform, config] of Object.entries(URL_PATTERNS)) {
		if (config.domain.test(normalizedUrl)) {
			return platform as SupportedPlatform;
		}
	}

	// Also check X.com for Twitter
	if (normalizedUrl.includes("x.com")) {
		return SUPPORTED_PLATFORMS.TWITTER;
	}

	return null;
}

/**
 * Extracts content ID from platform URL
 */
export function extractContentId(
	url: string,
	platform: SupportedPlatform,
): string | null {
	try {
		const urlObj = new URL(url);
		const patterns = URL_PATTERNS[platform]?.patterns || [];

		for (const pattern of patterns) {
			const match = urlObj.pathname.match(pattern);
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
 * Sanitizes URL for safe processing
 */
export function sanitize(url: string): string {
	try {
		const urlObj = new URL(url.trim());
		// Remove potentially dangerous query parameters
		const safeUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
		return safeUrl;
	} catch {
		throw new Error("Invalid URL format");
	}
}
