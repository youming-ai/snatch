import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { apiKeyAuth } from "./auth";

function createTestApp() {
	const app = new Hono();
	app.use("*", apiKeyAuth());
	app.get("/test", (c) => c.json({ ok: true }));
	return app;
}

describe("apiKeyAuth middleware", () => {
	const prevKey = process.env.API_KEY;

	beforeEach(() => {
		delete process.env.API_KEY;
	});

	afterEach(() => {
		if (prevKey === undefined) delete process.env.API_KEY;
		else process.env.API_KEY = prevKey;
	});

	it("is a no-op when API_KEY is unset (public instance)", async () => {
		const app = createTestApp();
		const res = await app.fetch(new Request("http://localhost/test"));
		expect(res.status).toBe(200);
	});

	it("accepts a request with a matching Api-Key header", async () => {
		process.env.API_KEY = "secret-key";
		const app = createTestApp();
		const res = await app.fetch(
			new Request("http://localhost/test", {
				headers: { Authorization: "Api-Key secret-key" },
			}),
		);
		expect(res.status).toBe(200);
	});

	it("rejects with 401 when the Authorization header is missing", async () => {
		process.env.API_KEY = "secret-key";
		const app = createTestApp();
		const res = await app.fetch(new Request("http://localhost/test"));
		expect(res.status).toBe(401);
		const body = (await res.json()) as { success: boolean };
		expect(body.success).toBe(false);
	});

	it("rejects with 401 when the scheme is wrong", async () => {
		process.env.API_KEY = "secret-key";
		const app = createTestApp();
		const res = await app.fetch(
			new Request("http://localhost/test", {
				headers: { Authorization: "Bearer secret-key" },
			}),
		);
		expect(res.status).toBe(401);
	});

	it("rejects with 403 when the key does not match", async () => {
		process.env.API_KEY = "secret-key";
		const app = createTestApp();
		const res = await app.fetch(
			new Request("http://localhost/test", {
				headers: { Authorization: "Api-Key wrong-key" },
			}),
		);
		expect(res.status).toBe(403);
	});

	it("lets CORS preflight (OPTIONS) through without auth", async () => {
		process.env.API_KEY = "secret-key";
		const app = createTestApp();
		// The test app only registers GET, so OPTIONS falls through to a 404 —
		// which is exactly what we want to assert: the middleware called next()
		// instead of short-circuiting with 401/403.
		const res = await app.fetch(new Request("http://localhost/test", { method: "OPTIONS" }));
		expect(res.status).not.toBe(401);
		expect(res.status).not.toBe(403);
	});
});
