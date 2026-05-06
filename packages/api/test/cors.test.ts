import { describe, expect, it } from "bun:test";

describe("CORS configuration", () => {
	it("should reject requests when ALLOWED_ORIGINS is empty and no origin header", async () => {
		// Save and clear env
		const orig = process.env.ALLOWED_ORIGINS;
		delete process.env.ALLOWED_ORIGINS;

		// Dynamically import to get fresh module
		const { default: app } = await import("../src/index");

		const res = await app.fetch(
			new Request("http://localhost:3001/api/health", {
				headers: {},
			}),
		);

		// Should not return Access-Control-Allow-Origin: *
		const acao = res.headers.get("Access-Control-Allow-Origin");
		expect(acao).not.toBe("*");

		// Restore
		if (orig !== undefined) process.env.ALLOWED_ORIGINS = orig;
	});
});
