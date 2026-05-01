import { beforeEach, describe, expect, it, mock } from "bun:test";
import { checkRateLimit, getClientId, validateDownloadRequest } from "./security";

// Mock the config module
mock.module("@/config/env", () => ({
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
		for (let i = 0; i < 10; i++) {
			checkRateLimit(clientId);
		}
		const result = checkRateLimit(clientId);
		expect(result.allowed).toBe(false);
		expect(result.resetTime).toBeDefined();
	});
});

describe("validateDownloadRequest", () => {
	it("should validate correct TikTok URL", () => {
		const result = validateDownloadRequest("https://www.tiktok.com/@user/video/1234567890");
		expect(result.valid).toBe(true);
		expect(result.platform).toBe("tiktok");
	});

	it("should validate correct X URL", () => {
		const result = validateDownloadRequest("https://x.com/user/status/1234567890");
		expect(result.valid).toBe(true);
		expect(result.platform).toBe("twitter");
	});

	it("should validate correct Twitter URL", () => {
		const result = validateDownloadRequest("https://twitter.com/user/status/1234567890");
		expect(result.valid).toBe(true);
		expect(result.platform).toBe("twitter");
	});

	it("should reject YouTube URLs", () => {
		const result = validateDownloadRequest("https://www.youtube.com/watch?v=jNQXAC9IVRw");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsupported platform");
	});

	it("should reject invalid URLs", () => {
		const result = validateDownloadRequest("not-a-url");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("should reject unsupported platforms", () => {
		const result = validateDownloadRequest("https://www.instagram.com/p/ABC");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsupported platform");
	});

	it("should reject YouTube URLs", () => {
		const result = validateDownloadRequest("https://www.youtube.com/watch?v=jNQXAC9IVRw");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsupported platform");
	});

	it("should validate correct X URL", () => {
		const result = validateDownloadRequest("https://x.com/user/status/1234567890");
		expect(result.valid).toBe(true);
		expect(result.platform).toBe("twitter");
	});

	it("should validate correct Twitter URL", () => {
		const result = validateDownloadRequest("https://twitter.com/user/status/1234567890");
		expect(result.valid).toBe(true);
		expect(result.platform).toBe("twitter");
	});

	it("should reject invalid URLs", () => {
		const result = validateDownloadRequest("not-a-url");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("should reject unsupported platforms", () => {
		const result = validateDownloadRequest("https://www.instagram.com/p/ABC");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsupported platform");
	});

	it("should handle suspicious user agents gracefully", () => {
		const result = validateDownloadRequest(
			"https://www.tiktok.com/@user/video/1234567890",
			"Googlebot/2.1",
		);
		expect(result.valid).toBe(true);
	});
});

describe("getClientId", () => {
	it("should ignore spoofable forwarding headers without a trusted source", () => {
		const first = new Request("https://snatch.test/api/download", {
			headers: { "x-forwarded-for": "1.1.1.1" },
		});
		const second = new Request("https://snatch.test/api/download", {
			headers: { "x-forwarded-for": "2.2.2.2" },
		});

		expect(getClientId(first)).toBe(getClientId(second));
	});

	it("should use the trusted platform header when present", () => {
		const first = new Request("https://snatch.test/api/download", {
			headers: { "cf-connecting-ip": "1.1.1.1" },
		});
		const second = new Request("https://snatch.test/api/download", {
			headers: { "cf-connecting-ip": "2.2.2.2" },
		});

		expect(getClientId(first)).not.toBe(getClientId(second));
	});
});
