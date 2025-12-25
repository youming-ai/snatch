import { describe, expect, it } from "vitest";
import {
	detectPlatform,
	extractContentId,
	sanitize,
	validate,
} from "./validation";

describe("detectPlatform", () => {
	it("should detect Instagram URLs", () => {
		expect(detectPlatform("https://www.instagram.com/p/ABC123")).toBe(
			"instagram",
		);
		expect(detectPlatform("https://instagram.com/reel/XYZ789")).toBe(
			"instagram",
		);
		expect(detectPlatform("https://www.instagram.com/tv/DEF456")).toBe(
			"instagram",
		);
	});

	it("should detect TikTok URLs", () => {
		expect(
			detectPlatform("https://www.tiktok.com/@user/video/1234567890"),
		).toBe("tiktok");
		expect(detectPlatform("https://tiktok.com/@user/video/1234567890")).toBe(
			"tiktok",
		);
		expect(detectPlatform("https://vm.tiktok.com/ABC123")).toBe("tiktok");
	});

	it("should detect Twitter/X URLs", () => {
		expect(detectPlatform("https://twitter.com/user/status/1234567890")).toBe(
			"twitter",
		);
		expect(detectPlatform("https://x.com/user/status/1234567890")).toBe(
			"twitter",
		);
		expect(detectPlatform("https://www.x.com/user/status/9876543210")).toBe(
			"twitter",
		);
	});

	it("should return null for unsupported platforms", () => {
		expect(detectPlatform("https://www.youtube.com/watch?v=123")).toBeNull();
		expect(detectPlatform("https://www.facebook.com/video/123")).toBeNull();
		expect(detectPlatform("https://example.com")).toBeNull();
		expect(detectPlatform("not-a-url")).toBeNull();
	});
});

describe("extractContentId", () => {
	it("should extract Instagram post ID", () => {
		expect(
			extractContentId("https://www.instagram.com/p/ABC123/", "instagram"),
		).toBe("ABC123");
		expect(
			extractContentId("https://instagram.com/reel/XYZ789/", "instagram"),
		).toBe("XYZ789");
		expect(
			extractContentId("https://www.instagram.com/tv/DEF456/", "instagram"),
		).toBe("DEF456");
	});

	it("should extract TikTok video ID", () => {
		expect(
			extractContentId(
				"https://www.tiktok.com/@user/video/1234567890",
				"tiktok",
			),
		).toBe("1234567890");
		expect(
			extractContentId("https://tiktok.com/video/9876543210", "tiktok"),
		).toBe("9876543210");
	});

	it("should extract Twitter status ID", () => {
		expect(
			extractContentId("https://twitter.com/user/status/1234567890", "twitter"),
		).toBe("1234567890");
		expect(
			extractContentId("https://x.com/user/status/9876543210", "twitter"),
		).toBe("9876543210");
	});

	it("should return null for invalid URLs", () => {
		expect(extractContentId("https://instagram.com/", "instagram")).toBeNull();
		expect(extractContentId("https://tiktok.com/@user", "tiktok")).toBeNull();
		expect(extractContentId("not-a-url", "twitter")).toBeNull();
	});
});

describe("validate", () => {
	it("should validate correct URLs", () => {
		const result = validate("https://www.instagram.com/p/ABC123/");
		expect(result.isValid).toBe(true);
		expect(result.platform).toBe("instagram");
		expect(result.contentId).toBe("ABC123");
		expect(result.errors).toHaveLength(0);
	});

	it("should reject empty URLs", () => {
		const result = validate("");
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain("URL is required");
	});

	it("should reject invalid URL format", () => {
		const result = validate("not-a-valid-url");
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain("Invalid URL format");
	});

	it("should reject unsupported platforms", () => {
		const result = validate("https://www.youtube.com/watch?v=123");
		expect(result.isValid).toBe(false);
		expect(result.errors[0]).toContain("Unsupported platform");
	});

	it("should reject URLs without content ID", () => {
		const result = validate("https://www.instagram.com/");
		expect(result.isValid).toBe(false);
		expect(result.errors[0]).toContain("Could not extract content ID");
	});
});

describe("sanitize", () => {
	it("should sanitize URLs correctly", () => {
		// Safe query parameters are preserved
		expect(sanitize("https://instagram.com/p/ABC123?query=test")).toBe(
			"https://instagram.com/p/ABC123?query=test",
		);
		expect(sanitize("  https://twitter.com/user/status/123  ")).toBe(
			"https://twitter.com/user/status/123",
		);
	});

	it("should remove dangerous query parameters", () => {
		// Dangerous params are removed
		expect(sanitize("https://instagram.com/p/ABC123?callback=evil")).toBe(
			"https://instagram.com/p/ABC123",
		);
		expect(sanitize("https://example.com?url=bad&safe=ok")).toBe(
			"https://example.com/?safe=ok",
		);
	});

	it("should reject dangerous protocols", () => {
		expect(() => sanitize("javascript:alert(1)")).toThrow("Dangerous protocol");
		expect(() => sanitize("data:text/html,<script>")).toThrow(
			"Dangerous protocol",
		);
		expect(() => sanitize("ftp://example.com")).toThrow("Dangerous protocol");
	});

	it("should reject XSS patterns", () => {
		expect(() => sanitize("https://example.com/<script>")).toThrow(
			"XSS pattern",
		);
		expect(() => sanitize("https://example.com/?onclick=evil")).toThrow(
			"XSS pattern",
		);
	});

	it("should throw on invalid URLs", () => {
		expect(() => sanitize("not-a-url")).toThrow("Invalid URL format");
	});
});
