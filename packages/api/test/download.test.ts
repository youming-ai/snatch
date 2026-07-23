import { beforeEach, describe, expect, it } from "bun:test";
import app from "../src/app";
import { clearClients } from "../src/middleware/rate-limit";

describe("POST /api/resolve validation", () => {
	beforeEach(() => {
		clearClients();
	});

	it("returns 400 when body is missing or invalid JSON", async () => {
		const res = await app.fetch(
			new Request("http://localhost:3001/api/resolve", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{ invalid json",
			}),
		);
		expect(res.status).toBe(400);
	});

	it("returns 400 when URL is missing", async () => {
		const res = await app.fetch(
			new Request("http://localhost:3001/api/resolve", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(400);
	});

	it("returns 400 when host is unsupported", async () => {
		const res = await app.fetch(
			new Request("http://localhost:3001/api/resolve", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: "https://unknown-host-12345.com/video" }),
			}),
		);
		expect(res.status).toBe(400);
	});
});
