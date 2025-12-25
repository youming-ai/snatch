import { getConfig } from "@/config/env";
import { validate } from "@/lib/validation";
import { getRateLimiter } from "@/lib/rate-limiter";
import type { SupportedPlatform } from "@/types/download";

/**
 * Security middleware functions for API requests
 */

// Legacy: Keep old function name for backwards compatibility, but delegate to new rate limiter
const requestCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple hash function for IP addresses (private helper)
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Rate limiting check - now uses persistent rate limiter
 */
export function checkRateLimit(clientId: string): {
  allowed: boolean;
  resetTime?: number;
} {
  try {
    const rateLimiter = getRateLimiter();
    return rateLimiter.check(clientId);
  } catch (error) {
    // Fallback to in-memory rate limiting if persistent limiter fails
    if (import.meta.env.DEV) {
      console.error("Rate limiter error, using fallback:", error);
    }

    const config = getConfig();
    const now = Date.now();
    const clientData = requestCounts.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      requestCounts.set(clientId, {
        count: 1,
        resetTime: now + config.rateLimitWindow,
      });
      return { allowed: true };
    }

    if (clientData.count >= config.rateLimitMax) {
      return {
        allowed: false,
        resetTime: clientData.resetTime,
      };
    }

    clientData.count++;
    return { allowed: true };
  }
}

/**
 * Generate client ID from request
 */
export function getClientId(request: Request): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip"); // CF proxy IP

  let ip = realIp || cfConnectingIp || "unknown";

  if (forwarded) {
    ip = forwarded.split(",")[0].trim();
  }

  // Hash IP for privacy
  return hashString(ip);
}

/**
 * Validate download request
 */
export function validateDownloadRequest(
  url: string,
  userAgent?: string,
): {
  valid: boolean;
  error?: string;
  platform?: SupportedPlatform;
} {
  // Basic URL validation
  const validation = validate(url);
  if (!validation.isValid) {
    return {
      valid: false,
      error: validation.errors.join(", "),
    };
  }

  // Check user agent (basic bot detection)
  if (userAgent) {
    const suspiciousPatterns = [/bot/i, /crawler/i, /spider/i, /scraper/i];

    if (suspiciousPatterns.some((pattern) => pattern.test(userAgent))) {
      // Only log in development for monitoring
      if (import.meta.env.DEV) {
        console.warn("Suspicious user agent detected:", userAgent);
      }
      // We don't block, but log for monitoring
    }
  }

  return {
    valid: true,
    platform: validation.platform,
  };
}

/**
 * Sanitize download response
 */
export function sanitizeResponse(
  results: Array<Record<string, unknown>>,
  platform: SupportedPlatform,
) {
  return results.map((result) => ({
    id: sanitizeString(result.id),
    type:
      result.type === "video" || result.type === "image"
        ? result.type
        : "unknown",
    url: sanitizeUrl(result.url),
    thumbnail: sanitizeUrl(result.thumbnail),
    downloadUrl: sanitizeUrl(result.downloadUrl),
    title: sanitizeString(result.title),
    size: sanitizeString(result.size),
    platform: platform,
  }));
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== "string") {
    return "Unknown";
  }

  return (
    input
      .replace(/<[^>]*>/g, "") // Remove HTML tags completely
      .replace(/javascript:/gi, "") // Remove javascript protocol
      .replace(/on\w+=/gi, "") // Remove event handlers
      .substring(0, 200) // Limit length
      .trim() || "Unknown"
  );
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: unknown): string {
  if (typeof url !== "string") {
    return "#";
  }

  try {
    const urlObj = new URL(url.trim());

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return "#";
    }

    // Remove dangerous query parameters
    const dangerousParams = ["callback", "jsonp", "redirect", "return"];
    dangerousParams.forEach((param) => {
      urlObj.searchParams.delete(param);
    });

    return urlObj.toString();
  } catch {
    return "#";
  }
}

/**
 * Clean up old rate limit data (legacy, for in-memory fallback)
 */
export function cleanupRateLimit(): void {
  const now = Date.now();

  for (const [clientId, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(clientId);
    }
  }
}

// Cleanup rate limit data every 5 minutes (legacy fallback)
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      cleanupRateLimit();
    },
    5 * 60 * 1000,
  );
}
