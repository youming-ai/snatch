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
 * - Removes dangerous query parameters
 * - Prevents JavaScript protocol injection
 * - Validates URL structure
 */
export function sanitize(url: string): string {
  try {
    const trimmedUrl = url.trim();

    // Prevent javascript: and other dangerous protocols
    const dangerousProtocols = [
      "javascript:",
      "data:",
      "vbscript:",
      "file:",
      "ftp:",
    ];
    const lowerUrl = trimmedUrl.toLowerCase();
    for (const protocol of dangerousProtocols) {
      if (lowerUrl.startsWith(protocol)) {
        throw new Error("Dangerous protocol detected");
      }
    }

    // Check for XSS patterns in URL
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
      /.fromCharCode/i,
      /.innerHTML/i,
      /.outerHTML/i,
      /eval\(/i,
      /expression\(/i,
    ];
    for (const pattern of xssPatterns) {
      if (pattern.test(trimmedUrl)) {
        throw new Error("XSS pattern detected");
      }
    }

    const urlObj = new URL(trimmedUrl);

    // Remove potentially dangerous query parameters
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

    // Filter out dangerous params
    const safeParams = new URLSearchParams();
    for (const [key, value] of urlObj.searchParams.entries()) {
      if (!dangerousParams.includes(key.toLowerCase())) {
        safeParams.append(key, value);
      }
    }

    // Build safe URL
    const safeUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    const queryString = safeParams.toString();
    return queryString ? `${safeUrl}?${queryString}` : safeUrl;
  } catch (e) {
    if (
      (e instanceof Error && e.message.includes("Dangerous")) ||
      e.message.includes("XSS")
    ) {
      throw e;
    }
    throw new Error("Invalid URL format");
  }
}
