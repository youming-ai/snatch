import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import app from "../src/app";
import { clearClients } from "../src/middleware/rate-limit";

const originalFetch = globalThis.fetch;

describe("POST /api/resolve", () => {
	beforeEach(() => {
		clearClients();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		delete process.env.COBALT_API_URL;
	});

	it("strips empty-string optional fields before forwarding to cobalt", async () => {
		process.env.COBALT_API_URL = "http://cobalt:9000";

		let capturedBody: string | null = null;
		globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = input instanceof Request ? input.url : String(input);
			if (url === "http://cobalt:9000/") {
				const rawBody = init?.body ?? (input instanceof Request ? await input.text() : null);
				capturedBody = typeof rawBody === "string" ? rawBody : null;
			}
			return new Response(
				JSON.stringify({ status: "error", error: { code: "error.api.youtube.login" } }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});

		const res = await app.fetch(
			new Request("http://localhost:3001/api/resolve", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					url: "https://www.youtube.com/watch?v=Rd8V1mOP97w",
					videoQuality: "max",
					audioFormat: "mp3",
					subtitleLang: "",
					youtubeDubLang: "",
				}),
			}),
		);

		expect(res.status).toBe(200);
		expect(capturedBody).toBeTruthy();

		const forwarded = JSON.parse(capturedBody!);
		expect(forwarded).toHaveProperty("url");
		expect(forwarded).not.toHaveProperty("subtitleLang");
		expect(forwarded).not.toHaveProperty("youtubeDubLang");
	});
});
