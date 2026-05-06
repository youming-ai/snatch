import { describe, expect, it } from "bun:test";
import app from "../src/index";

describe("CORS configuration", () => {
	it("should reject requests when ALLOWED_ORIGINS is empty and no origin header", async () => {
		const orig = process.env.ALLOWED_ORIGINS;
		delete process.env.ALLOWED_ORIGINS;

		const res = await app.fetch(
			new Request("http://localhost:3001/api/health", {
				headers: {},
			}),
		);

		const acao = res.headers.get("Access-Control-Allow-Origin");
		expect(acao).toBeNull();

		if (orig !== undefined) process.env.ALLOWED_ORIGINS = orig;
	});

	it("should not echo origin when ALLOWED_ORIGINS is empty", async () => {
		const orig = process.env.ALLOWED_ORIGINS;
		delete process.env.ALLOWED_ORIGINS;

		const res = await app.fetch(
			new Request("http://localhost:3001/api/health", {
				headers: { Origin: "http://evil.com" },
			}),
		);

		const acao = res.headers.get("Access-Control-Allow-Origin");
		expect(acao).toBeNull();

		if (orig !== undefined) process.env.ALLOWED_ORIGINS = orig;
	});
});
