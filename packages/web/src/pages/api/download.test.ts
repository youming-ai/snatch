import { describe, expect, it, mock } from "bun:test";
import { GET, POST } from "./download";

mock.module("@/config/env", () => ({
	getConfig: () => ({ rateLimitWindow: 60000, rateLimitMax: 1 }),
}));

function makeRequest(url: string, init?: RequestInit): Request {
	return new Request(url, {
		...init,
		headers: {
			"user-agent": `test-agent-${crypto.randomUUID()}`,
			...(init?.headers || {}),
		},
	});
}

describe("GET /api/download", () => {
	it("should reject unsupported URLs before proxying", async () => {
		const response = await GET({
			request: makeRequest(
				"https://snatch.test/api/download?url=https%3A%2F%2Fevil.com%2Fx.com%2Fuser%2Fstatus%2F123",
			),
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toContain("Unsupported platform");
	});

	it("should rate limit direct download requests", async () => {
		const url =
			"https://snatch.test/api/download?url=https%3A%2F%2Fx.com%2Fuser%2Fstatus%2F1234567890";
		await GET({
			request: makeRequest(url, { headers: { "user-agent": "limited-agent" } }),
		} as Parameters<typeof GET>[0]);
		const second = await GET({
			request: makeRequest(url, { headers: { "user-agent": "limited-agent" } }),
		} as Parameters<typeof GET>[0]);

		expect(second.status).toBe(429);
	});
});

describe("POST /api/download", () => {
	it("should reject bodies over 10KB without relying on content-length", async () => {
		const response = await POST({
			request: makeRequest("https://snatch.test/api/download", {
				method: "POST",
				body: JSON.stringify({
					url: "https://x.com/user/status/1234567890",
					pad: "x".repeat(11 * 1024),
				}),
				headers: { "content-type": "application/json" },
			}),
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(413);
	});
});
