import { beforeEach, describe, expect, it } from "bun:test";
import app from "../src/app";
import { clearClients } from "../src/middleware/rate-limit";

describe("response hardening", () => {
	beforeEach(() => {
		clearClients();
	});

	it("applies the baseline headers to API responses", async () => {
		const res = await app.fetch(new Request("http://localhost:3001/api/info"));

		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("X-Frame-Options")).toBe("DENY");
		expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
		expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=15552000");
	});

	it("applies them to a rejected request too", async () => {
		// A disallowed CORS origin is not a rejection — it still answers 200 and
		// only omits the header — so drive a real 4xx through the auth gate.
		const previous = process.env.API_KEY;
		process.env.API_KEY = "test-key";
		try {
			const res = await app.fetch(new Request("http://localhost:3001/api/info"));

			expect(res.status).toBe(401);
			expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
			expect(res.headers.get("X-Frame-Options")).toBe("DENY");
		} finally {
			if (previous === undefined) delete process.env.API_KEY;
			else process.env.API_KEY = previous;
		}
	});

	it("does not advertise the server framework", async () => {
		const res = await app.fetch(new Request("http://localhost:3001/api/info"));
		expect(res.headers.get("X-Powered-By")).toBeNull();
	});
});
