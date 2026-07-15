import { afterEach, describe, expect, it, mock } from "bun:test";
import * as crypto from "node:crypto";

// Set fixed signing key and cobalt URL in environment BEFORE importing Hono app
process.env.PROXY_SIGNING_KEY = "test-key";
process.env.COBALT_API_URL = "http://cobalt:9000";

import app from "../src/index";
import { resetCobaltApiUrlForTest, setCobaltApiUrlForTest } from "../src/lib/cobalt";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	resetCobaltApiUrlForTest();
});

function mockFetchResponse(body: unknown, status = 200): void {
	globalThis.fetch = mock(async () => new Response(JSON.stringify(body), { status }));
}

function computeSignature(targetUrl: string): string {
	return crypto.createHmac("sha256", "test-key").update(targetUrl).digest("hex");
}

describe("API Routes", () => {
	describe("POST /api/resolve", () => {
		it("should reject invalid URLs", async () => {
			const res = await app.fetch(
				new Request("http://localhost:3001/api/resolve", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ url: "not-a-url" }),
				}),
			);
			expect(res.status).toBe(400);
			const data = (await res.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toContain("Invalid URL");
		});

		it("should resolve and rewrite tunnel URLs with valid signatures", async () => {
			setCobaltApiUrlForTest("http://cobalt:9000");
			mockFetchResponse({
				status: "tunnel",
				url: "http://cobalt:9000/tunnel?id=test",
				filename: "video.mp4",
			});

			const res = await app.fetch(
				new Request("http://localhost:3001/api/resolve", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ url: "https://x.com/user/status/1" }),
				}),
			);

			expect(res.status).toBe(200);
			const data = (await res.json()) as { status: string; url: string; filename: string };
			expect(data.status).toBe("tunnel");
			expect(data.url).toContain("/api/proxy?url=");
			expect(data.url).toContain("sig=");
			expect(data.filename).toBe("video.mp4");
		});
	});

	describe("GET /api/info", () => {
		it("should return cobalt instance metadata", async () => {
			setCobaltApiUrlForTest("http://cobalt:9000");
			const mockMetadata = {
				cobalt: { version: "11.0.0", url: "http://cobalt:9000/" },
				git: { commit: "abc" },
			};
			mockFetchResponse(mockMetadata);

			const res = await app.fetch(new Request("http://localhost:3001/api/info"));
			expect(res.status).toBe(200);
			const data = (await res.json()) as typeof mockMetadata;
			expect(data.cobalt.version).toBe("11.0.0");
		});
	});

	describe("GET /api/proxy", () => {
		it("should proxy streams with valid signatures", async () => {
			globalThis.fetch = mock(
				async () =>
					new Response("media_bytes", {
						status: 200,
						headers: {
							"Content-Type": "video/mp4",
							"Content-Length": "11",
						},
					}),
			);

			const targetUrl = "http://cobalt:9000/tunnel?id=xyz";
			const sig = computeSignature(targetUrl);
			const res = await app.fetch(
				new Request(
					`http://localhost:3001/api/proxy?url=${encodeURIComponent(targetUrl)}&sig=${sig}&filename=test.mp4`,
				),
			);

			expect(res.status).toBe(200);
			expect(res.headers.get("Content-Type")).toBe("video/mp4");
			const text = await res.text();
			expect(text).toBe("media_bytes");
		});

		it("should reject proxy requests without parameters", async () => {
			const res = await app.fetch(new Request("http://localhost:3001/api/proxy"));
			expect(res.status).toBe(400);
		});

		it("should reject proxy requests with invalid signatures", async () => {
			const targetUrl = "http://cobalt:9000/tunnel?id=xyz";
			const res = await app.fetch(
				new Request(
					`http://localhost:3001/api/proxy?url=${encodeURIComponent(targetUrl)}&sig=fakesig`,
				),
			);
			expect(res.status).toBe(403);
		});

		it("should reject SSRF loopback/link-local attempts even if signed", async () => {
			const evilUrl = "http://169.254.169.254/latest/meta-data/";
			const sig = computeSignature(evilUrl);
			const res = await app.fetch(
				new Request(
					`http://localhost:3001/api/proxy?url=${encodeURIComponent(evilUrl)}&sig=${sig}`,
				),
			);
			expect(res.status).toBe(403);
			const data = (await res.json()) as { error: string };
			expect(data.error).toContain("Forbidden");
		});
	});
});
