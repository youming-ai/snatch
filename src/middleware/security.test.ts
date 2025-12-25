import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, validateDownloadRequest } from "./security";

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
