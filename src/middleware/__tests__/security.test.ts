import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkRateLimit,
	cleanupRateLimit,
	generateCSRFToken,
	sanitizeString,
	sanitizeUrl,
	validateCSRFToken,
} from "../security";

describe("security middleware", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanupRateLimit();
	});

	describe("sanitizeString", () => {
		it("should remove HTML tags", () => {
			const result = sanitizeString("<script>alert('xss')</script>");
			expect(result).toBe("alert('xss')");
		});

		it("should remove javascript protocol", () => {
			const result = sanitizeString("javascript:alert('xss')");
			expect(result).not.toContain("javascript:");
		});

		it("should handle non-string inputs", () => {
			expect(sanitizeString(123)).toBe("Unknown");
			expect(sanitizeString(null)).toBe("Unknown");
			expect(sanitizeString(undefined)).toBe("Unknown");
		});

		it("should limit string length", () => {
			const longString = "a".repeat(300);
			const result = sanitizeString(longString);
			expect(result.length).toBeLessThanOrEqual(200);
		});
	});

	describe("sanitizeUrl", () => {
		it("should reject non-HTTP/HTTPS URLs", () => {
			const result = sanitizeUrl("ftp://example.com/file.txt");
			expect(result).toBe("#");
		});

		it("should handle malformed URLs", () => {
			const result = sanitizeUrl("not-a-url");
			expect(result).toBe("#");
		});

		it("should handle non-string inputs", () => {
			expect(sanitizeUrl(123)).toBe("#");
			expect(sanitizeUrl(null)).toBe("#");
		});
	});

	describe("CSRF token validation", () => {
		it("should generate valid CSRF tokens", () => {
			const token = generateCSRFToken();
			expect(token).toBeDefined();
			expect(typeof token).toBe("string");
			expect(token.length).toBeGreaterThan(0);
		});

		it("should reject empty tokens", () => {
			const result = validateCSRFToken("", "");
			expect(result).toBe(false);
		});

		it("should reject non-matching tokens", () => {
			const token1 = generateCSRFToken();
			const token2 = generateCSRFToken();
			const result = validateCSRFToken(token1, token2);
			expect(result).toBe(false);
		});
	});

	describe("checkRateLimit", () => {
		it("should allow requests under limit", () => {
			const clientId = "test-client";

			// First request should be allowed
			const result1 = checkRateLimit(clientId);
			expect(result1.allowed).toBe(true);
		});
	});
});
