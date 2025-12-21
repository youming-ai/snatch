import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkRateLimit,
	sanitizeString,
	sanitizeUrl,
	validateDownloadRequest,
} from "./security";

// Mock the config module
vi.mock("@/config/env", () => ({
	getConfig: () => ({
		rateLimitWindow: 60000,
		rateLimitMax: 10,
	}),
}));

describe("checkRateLimit", () => {
	beforeEach(() => {
		// Reset rate limit state between tests by using unique client IDs
	});

	it("should allow first request", () => {
		const clientId = `test-client-${Date.now()}-1`;
		const result = checkRateLimit(clientId);
		expect(result.allowed).toBe(true);
	});

	it("should allow requests within limit", () => {
		const clientId = `test-client-${Date.now()}-2`;
		for (let i = 0; i < 5; i++) {
			const result = checkRateLimit(clientId);
			expect(result.allowed).toBe(true);
		}
	});

	it("should block requests exceeding limit", () => {
		const clientId = `test-client-${Date.now()}-3`;
		// Make 10 requests (the limit)
		for (let i = 0; i < 10; i++) {
			checkRateLimit(clientId);
		}
		// 11th request should be blocked
		const result = checkRateLimit(clientId);
		expect(result.allowed).toBe(false);
		expect(result.resetTime).toBeDefined();
	});
});

describe("sanitizeString", () => {
	it("should return 'Unknown' for non-strings", () => {
		expect(sanitizeString(null)).toBe("Unknown");
		expect(sanitizeString(undefined)).toBe("Unknown");
		expect(sanitizeString(123)).toBe("Unknown");
		expect(sanitizeString({})).toBe("Unknown");
	});

	it("should remove HTML tags", () => {
		expect(sanitizeString("<script>alert('xss')</script>")).toBe(
			"alert('xss')",
		);
		expect(sanitizeString("<b>bold</b>")).toBe("bold");
		expect(sanitizeString("Hello <a href='#'>World</a>")).toBe("Hello World");
	});

	it("should remove javascript: protocol", () => {
		expect(sanitizeString("javascript:alert(1)")).toBe("alert(1)");
	});

	it("should remove event handlers", () => {
		expect(sanitizeString('text onclick="evil()"')).toBe('text "evil()"');
	});

	it("should limit string length", () => {
		const longString = "a".repeat(300);
		expect(sanitizeString(longString).length).toBe(200);
	});

	it("should return 'Unknown' for empty strings after sanitization", () => {
		expect(sanitizeString("   ")).toBe("Unknown");
		expect(sanitizeString("<script></script>")).toBe("Unknown");
	});
});

describe("sanitizeUrl", () => {
	it("should return '#' for non-strings", () => {
		expect(sanitizeUrl(null)).toBe("#");
		expect(sanitizeUrl(undefined)).toBe("#");
		expect(sanitizeUrl(123)).toBe("#");
	});

	it("should allow valid http/https URLs", () => {
		expect(sanitizeUrl("https://example.com/path")).toBe(
			"https://example.com/path",
		);
		expect(sanitizeUrl("http://test.com/page")).toBe("http://test.com/page");
	});

	it("should reject non-http protocols", () => {
		expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
		expect(sanitizeUrl("ftp://example.com")).toBe("#");
		expect(sanitizeUrl("file:///etc/passwd")).toBe("#");
	});

	it("should remove dangerous query parameters", () => {
		expect(sanitizeUrl("https://example.com?callback=evil")).toBe(
			"https://example.com/",
		);
		expect(sanitizeUrl("https://example.com?redirect=bad&safe=ok")).toBe(
			"https://example.com/?safe=ok",
		);
	});

	it("should return '#' for invalid URLs", () => {
		expect(sanitizeUrl("not-a-url")).toBe("#");
		expect(sanitizeUrl("")).toBe("#");
	});
});

describe("validateDownloadRequest", () => {
	it("should validate correct TikTok URL", () => {
		const result = validateDownloadRequest(
			"https://www.tiktok.com/@user/video/1234567890",
		);
		expect(result.valid).toBe(true);
		expect(result.platform).toBe("tiktok");
	});

	it("should validate correct Instagram URL", () => {
		const result = validateDownloadRequest(
			"https://www.instagram.com/p/ABC123/",
		);
		expect(result.valid).toBe(true);
		expect(result.platform).toBe("instagram");
	});

	it("should validate correct Twitter URL", () => {
		const result = validateDownloadRequest(
			"https://twitter.com/user/status/1234567890",
		);
		expect(result.valid).toBe(true);
		expect(result.platform).toBe("twitter");
	});

	it("should reject invalid URLs", () => {
		const result = validateDownloadRequest("not-a-url");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("should reject unsupported platforms", () => {
		const result = validateDownloadRequest(
			"https://www.youtube.com/watch?v=123",
		);
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsupported platform");
	});

	it("should handle suspicious user agents gracefully", () => {
		// Should still validate but log warning
		const result = validateDownloadRequest(
			"https://www.tiktok.com/@user/video/1234567890",
			"Googlebot/2.1",
		);
		expect(result.valid).toBe(true);
	});
});
