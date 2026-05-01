import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { extractRouter } from "../src/routes/extract";

describe("extract route", () => {
	it("should return 400 for malformed JSON", async () => {
		const app = new Hono();
		app.route("/", extractRouter);

		const response = await app.request("/api/extract", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{invalid",
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body).toEqual({ success: false, error: "Invalid JSON in request body" });
	});
});
