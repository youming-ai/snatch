import { beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { clearClients, rateLimit } from "./rate-limit";

function createTestApp(maxRequests = 3, windowMs = 1000) {
	const app = new Hono();
	app.use("*", rateLimit({ maxRequests, windowMs }));
	app.get("/test", (c) => c.json({ ok: true }));
	return app;
}

describe("rateLimit middleware", () => {
	beforeEach(() => {
		clearClients();
	});

	it("should allow requests within limit", async () => {
		const app = createTestApp(3, 1000);
		const req = new Request("http://localhost/test", {
			headers: { "user-agent": "test-agent-1" },
		});
		const res = await app.fetch(req);
		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Limit")).toBe("3");
		expect(res.headers.get("X-RateLimit-Remaining")).toBe("2");
	});

	it("should block requests exceeding limit", async () => {
		const app = createTestApp(2, 1000);
		const headers = { "user-agent": "test-agent-block" };

		await app.fetch(new Request("http://localhost/test", { headers }));
		await app.fetch(new Request("http://localhost/test", { headers }));
		const res = await app.fetch(new Request("http://localhost/test", { headers }));

		expect(res.status).toBe(429);
		expect(res.headers.get("Retry-After")).toBeDefined();
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain("Rate limit");
	});

	it("should include rate limit headers on success", async () => {
		const app = createTestApp(5, 60000);
		const res = await app.fetch(
			new Request("http://localhost/test", {
				headers: { "user-agent": "test-agent-headers" },
			}),
		);
		expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
		expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
		expect(res.headers.get("X-RateLimit-Reset")).toBeDefined();
	});

	it("should use trusted IP header for client identification", async () => {
		const app = createTestApp(2, 1000);
		const headers = { "cf-connecting-ip": "1.2.3.4" };

		const res1 = await app.fetch(new Request("http://localhost/test", { headers }));
		expect(res1.status).toBe(200);

		const res2 = await app.fetch(new Request("http://localhost/test", { headers }));
		expect(res2.status).toBe(200);

		const res3 = await app.fetch(new Request("http://localhost/test", { headers }));
		expect(res3.status).toBe(429);
	});
});
