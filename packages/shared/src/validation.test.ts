import { describe, expect, it } from "bun:test";
import { detectPlatform, validateUrl } from "./validation";

describe("validateUrl", () => {
	it("should accept URLs from supported services", () => {
		expect(validateUrl("https://www.tiktok.com/@user/video/1234567890").valid).toBe(true);
		expect(validateUrl("https://x.com/user/status/1234567890").valid).toBe(true);
		expect(validateUrl("https://twitter.com/user/status/1234567890").valid).toBe(true);
		expect(validateUrl("https://youtu.be/jNQXAC9IVRw").valid).toBe(true);
		expect(validateUrl("https://vimeo.com/357274789").valid).toBe(true);
	});

	it("should reject unsupported hosts", () => {
		const result = validateUrl("https://example.com/video/1");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsupported platform");
	});

	it("should reject empty URLs", () => {
		expect(validateUrl("").valid).toBe(false);
	});

	it("should reject invalid protocols", () => {
		expect(validateUrl("ftp://example.com").valid).toBe(false);
	});

	it("should reject URLs containing whitespace", () => {
		expect(validateUrl("https://x.com/ user").valid).toBe(false);
	});

	it("should accept URLs with multiple query parameters", () => {
		expect(validateUrl("https://x.com/i/status/1?a=1&b=2").valid).toBe(true);
	});

	it("should reject invalid URL format", () => {
		expect(validateUrl("not-a-url").valid).toBe(false);
	});
});

describe("detectPlatform", () => {
	it("should detect the canonical service id from the host", () => {
		expect(detectPlatform("https://www.tiktok.com/@user/video/1234567890")).toBe("tiktok");
		expect(detectPlatform("https://x.com/user/status/1234567890")).toBe("twitter");
		expect(detectPlatform("https://twitter.com/user/status/1234567890")).toBe("twitter");
		expect(detectPlatform("https://www.instagram.com/p/ABC123")).toBe("instagram");
		expect(detectPlatform("https://www.youtube.com/watch?v=jNQXAC9IVRw")).toBe("youtube");
	});

	it("should return null for unsupported hosts", () => {
		expect(detectPlatform("https://example.com/video/1")).toBeNull();
		expect(detectPlatform("not-a-url")).toBeNull();
	});
});

describe("URL validation hardening", () => {
	it("should reject spoofed platform domains in path", () => {
		expect(detectPlatform("https://evil.com/x.com/user/status/1234567890")).toBeNull();
		expect(validateUrl("https://evil.com/x.com/user/status/1234567890").valid).toBe(false);
	});
});
