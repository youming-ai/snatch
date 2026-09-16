import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { clearClients, rateLimit } from "./rate-limit";

const prevIpHeader = process.env.API_IP_HEADER;

function createTestApp(maxRequests = 3, windowMs = 1000) {
	const app = new Hono();
	app.use("*", rateLimit({ maxRequests, windowMs }));
	app.get("/test", (c) => c.json({ ok: true }));
	return app;
}

/** Same routes, but limits resolved from the environment. */
function createEnvApp() {
	const app = new Hono();
	app.use("*", rateLimit());
	app.get("/test", (c) => c.json({ ok: true }));
	return app;
}

async function fetchTest(
	app: { fetch: (req: Request) => Response | Promise<Response> },
	headers: Record<string, string> = {},
): Promise<Response> {
	return await app.fetch(new Request("http://localhost/test", { headers }));
}

describe("rateLimit middleware", () => {
	beforeEach(() => {
		clearClients();
		delete process.env.API_IP_HEADER;
	});

	afterEach(() => {
		if (prevIpHeader === undefined) delete process.env.API_IP_HEADER;
		else process.env.API_IP_HEADER = prevIpHeader;
	});

	it("should allow requests within limit", async () => {
		const res = await fetchTest(createTestApp(3, 1000), { "user-agent": "test-agent-1" });
		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Limit")).toBe("3");
		expect(res.headers.get("X-RateLimit-Remaining")).toBe("2");
	});

	it("should block requests exceeding limit", async () => {
		const app = createTestApp(2, 1000);
		const headers = { "user-agent": "test-agent-block" };

		await fetchTest(app, headers);
		await fetchTest(app, headers);
		const res = await fetchTest(app, headers);

		expect(res.status).toBe(429);
		expect(res.headers.get("Retry-After")).toBeDefined();
		const body = (await res.json()) as { error: string };
		expect(body.error).toContain("Rate limit");
	});

	it("should include rate limit headers on success", async () => {
		const res = await fetchTest(createTestApp(5, 60000), { "user-agent": "test-agent-headers" });
		expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
		expect(res.headers.get("X-RateLimit-Remaining")).toBe("4");
		expect(res.headers.get("X-RateLimit-Reset")).toBeDefined();
	});

	it("buckets each trusted IP separately", async () => {
		const app = createTestApp(1, 1000);

		expect((await fetchTest(app, { "cf-connecting-ip": "1.1.1.1" })).status).toBe(200);
		expect((await fetchTest(app, { "cf-connecting-ip": "2.2.2.2" })).status).toBe(200);
		expect((await fetchTest(app, { "cf-connecting-ip": "1.1.1.1" })).status).toBe(429);
	});

	it("honours the header a reverse proxy is configured to set", async () => {
		process.env.API_IP_HEADER = "X-Real-IP";
		const app = createTestApp(1, 1000);
		// Same user agent, different addresses: the configured header must win.
		await fetchTest(app, { "user-agent": "ua", "x-real-ip": "3.3.3.3" });
		expect((await fetchTest(app, { "user-agent": "ua", "x-real-ip": "4.4.4.4" })).status).toBe(200);
		expect((await fetchTest(app, { "user-agent": "ua", "x-real-ip": "3.3.3.3" })).status).toBe(429);
	});

	it("does not trust x-forwarded-for unless it is configured", async () => {
		const app = createTestApp(1, 1000);
		// Rotating a spoofable header must not buy a fresh bucket.
		await fetchTest(app, { "user-agent": "ua", "x-forwarded-for": "5.5.5.5" });
		expect(
			(await fetchTest(app, { "user-agent": "ua", "x-forwarded-for": "6.6.6.6" })).status,
		).toBe(429);
	});

	it("buckets on the first hop of a comma-separated chain", async () => {
		process.env.API_IP_HEADER = "x-real-ip";
		const app = createTestApp(1, 1000);

		await fetchTest(app, { "x-real-ip": "7.7.7.7, 10.0.0.1" });
		expect((await fetchTest(app, { "x-real-ip": "7.7.7.7, 10.0.0.9" })).status).toBe(429);
	});

	it("falls back to the default limit rather than disabling it", async () => {
		const prevMax = process.env.API_RATE_LIMIT_MAX;
		process.env.API_RATE_LIMIT_MAX = "not-a-number";
		try {
			const res = await fetchTest(createEnvApp(), { "user-agent": "ua-env" });
			expect(res.status).toBe(200);
			expect(res.headers.get("X-RateLimit-Limit")).toBe("30");
		} finally {
			if (prevMax === undefined) delete process.env.API_RATE_LIMIT_MAX;
			else process.env.API_RATE_LIMIT_MAX = prevMax;
		}
	});
});
