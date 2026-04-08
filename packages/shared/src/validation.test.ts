import { describe, expect, it } from "bun:test";
import {
	detectPlatform,
	extractContentId,
	formatFileSize,
	isRetryableError,
	parseQuality,
	sanitizeUrl,
	validate,
	validateUrl,
} from "./validation";

describe("validateUrl", () => {
	it("should accept valid Instagram URLs", () => {
		expect(validateUrl("https://instagram.com/p/ABC123").valid).toBe(true);
		expect(validateUrl("https://www.instagram.com/reel/xyz").valid).toBe(true);
	});

	it("should accept valid TikTok URLs", () => {
		expect(validateUrl("https://tiktok.com/@user/video/123").valid).toBe(true);
		expect(validateUrl("https://www.tiktok.com/video/123").valid).toBe(true);
	});

	it("should accept valid Twitter/X URLs", () => {
		expect(validateUrl("https://twitter.com/user/status/123").valid).toBe(true);
		expect(validateUrl("https://x.com/user/status/123").valid).toBe(true);
	});

	it("should reject empty URLs", () => {
		expect(validateUrl("").valid).toBe(false);
	});

	it("should reject invalid protocols", () => {
		expect(validateUrl("ftp://example.com").valid).toBe(false);
	});

	it("should reject unsupported platforms", () => {
		expect(validateUrl("https://youtube.com/watch?v=123").valid).toBe(false);
		expect(validateUrl("https://facebook.com/video/123").valid).toBe(false);
	});

	it("should reject command injection attempts", () => {
		expect(validateUrl("https://instagram.com/p/123; rm -rf /").valid).toBe(false);
		expect(validateUrl("https://instagram.com/p/123| cat /etc/passwd").valid).toBe(false);
		expect(validateUrl("https://instagram.com/p/123& malicious").valid).toBe(false);
		expect(validateUrl("https://instagram.com/p/123$(whoami)").valid).toBe(false);
		expect(validateUrl("https://instagram.com/p/123`whoami`").valid).toBe(false);
	});

	it("should reject invalid URL format", () => {
		expect(validateUrl("not-a-url").valid).toBe(false);
	});
});

describe("detectPlatform", () => {
	it("should detect Instagram URLs", () => {
		expect(detectPlatform("https://www.instagram.com/p/ABC123")).toBe("instagram");
		expect(detectPlatform("https://instagram.com/reel/XYZ789")).toBe("instagram");
	});

	it("should detect TikTok URLs", () => {
		expect(detectPlatform("https://www.tiktok.com/@user/video/1234567890")).toBe("tiktok");
		expect(detectPlatform("https://tiktok.com/@user/video/1234567890")).toBe("tiktok");
	});

	it("should detect Twitter/X URLs", () => {
		expect(detectPlatform("https://twitter.com/user/status/1234567890")).toBe("twitter");
		expect(detectPlatform("https://x.com/user/status/1234567890")).toBe("twitter");
	});

	it("should return null for unsupported platforms", () => {
		expect(detectPlatform("https://www.youtube.com/watch?v=123")).toBeNull();
		expect(detectPlatform("not-a-url")).toBeNull();
	});
});

describe("extractContentId", () => {
	it("should extract Instagram post ID", () => {
		expect(extractContentId("https://www.instagram.com/p/ABC123/", "instagram")).toBe("ABC123");
		expect(extractContentId("https://instagram.com/reel/XYZ789/", "instagram")).toBe("XYZ789");
	});

	it("should extract TikTok video ID", () => {
		expect(extractContentId("https://www.tiktok.com/@user/video/1234567890", "tiktok")).toBe(
			"1234567890",
		);
	});

	it("should extract Twitter status ID", () => {
		expect(extractContentId("https://twitter.com/user/status/1234567890", "twitter")).toBe(
			"1234567890",
		);
	});

	it("should return null for URLs without content ID", () => {
		expect(extractContentId("https://instagram.com/", "instagram")).toBeNull();
	});
});

describe("validate", () => {
	it("should validate correct URLs", () => {
		const result = validate("https://www.instagram.com/p/ABC123/");
		expect(result.isValid).toBe(true);
		expect(result.platform).toBe("instagram");
		expect(result.contentId).toBe("ABC123");
	});

	it("should reject empty URLs", () => {
		expect(validate("").isValid).toBe(false);
	});

	it("should reject unsupported platforms", () => {
		const result = validate("https://www.youtube.com/watch?v=123");
		expect(result.isValid).toBe(false);
		expect(result.errors[0]).toContain("Unsupported platform");
	});
});

describe("sanitizeUrl", () => {
	it("should preserve safe query parameters", () => {
		expect(sanitizeUrl("https://instagram.com/p/ABC123?query=test")).toBe(
			"https://instagram.com/p/ABC123?query=test",
		);
	});

	it("should remove dangerous query parameters", () => {
		expect(sanitizeUrl("https://instagram.com/p/ABC123?callback=evil")).toBe(
			"https://instagram.com/p/ABC123",
		);
	});

	it("should reject dangerous protocols", () => {
		expect(() => sanitizeUrl("javascript:alert(1)")).toThrow("Dangerous protocol");
	});

	it("should reject XSS patterns", () => {
		expect(() => sanitizeUrl("https://example.com/<script>")).toThrow("XSS pattern");
	});
});

describe("isRetryableError", () => {
	it("should mark validation errors as non-retryable", () => {
		expect(isRetryableError("Invalid URL format")).toBe(false);
		expect(isRetryableError("Unsupported platform: youtube.com")).toBe(false);
	});

	it("should mark network errors as retryable", () => {
		expect(isRetryableError("connection timeout")).toBe(true);
		expect(isRetryableError("network error")).toBe(true);
	});
});

describe("parseQuality", () => {
	it("should parse HD qualities", () => {
		expect(parseQuality("1080p")).toBe("hd");
		expect(parseQuality("720p")).toBe("hd");
		expect(parseQuality("best")).toBe("hd");
	});

	it("should parse audio quality", () => {
		expect(parseQuality("audio")).toBe("audio");
	});

	it("should default to SD", () => {
		expect(parseQuality("480p")).toBe("sd");
		expect(parseQuality("medium")).toBe("sd");
	});
});

describe("formatFileSize", () => {
	it("should format bytes", () => {
		expect(formatFileSize(500)).toBe("500 B");
		expect(formatFileSize(1500)).toBe("1.5 KB");
		expect(formatFileSize(1500000)).toBe("1.4 MB");
	});
});
