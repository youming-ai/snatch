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
		const res = await app.fetch(
			new Request("http://localhost:3001/api/info", { headers: { Origin: "http://evil.com" } }),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});

	it("does not advertise the server framework", async () => {
		const res = await app.fetch(new Request("http://localhost:3001/api/info"));
		expect(res.headers.get("X-Powered-By")).toBeNull();
	});
});
