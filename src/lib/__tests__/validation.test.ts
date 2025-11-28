import { describe, expect, it } from "vitest";
import { detectPlatform, validate } from "../validation";

describe("validation", () => {
	describe("validate", () => {
		it("should handle basic URL validation", () => {
			const result = validate("https://example.com");
			expect(result.errors).toBeDefined();
		});

		it("should reject empty URLs", () => {
			const result = validate("");
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("URL is required");
		});

		it("should reject null/undefined inputs", () => {
			expect(validate(null as unknown as string).isValid).toBe(false);
			expect(validate(undefined as unknown as string).isValid).toBe(false);
		});
	});

	describe("detectPlatform", () => {
		it("should detect Instagram platform", () => {
			expect(detectPlatform("https://instagram.com/p/test")).toBe("instagram");
		});

		it("should detect Twitter/X platform", () => {
			expect(detectPlatform("https://x.com/status/123")).toBe("twitter");
			expect(detectPlatform("https://twitter.com/status/123")).toBe("twitter");
		});

		it("should detect TikTok platform", () => {
			expect(detectPlatform("https://tiktok.com/@user/video/123")).toBe(
				"tiktok",
			);
		});

		it("should return null for unsupported platforms", () => {
			expect(detectPlatform("https://facebook.com/post")).toBeNull();
		});
	});
});
