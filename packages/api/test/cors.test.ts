import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import app from "../src/app";
import { clearClients } from "../src/middleware/rate-limit";

const prevOrigins = process.env.ALLOWED_ORIGINS;

function setAllowedOrigins(value: string | undefined): void {
	if (value === undefined) delete process.env.ALLOWED_ORIGINS;
	else process.env.ALLOWED_ORIGINS = value;
}

async function request(origin?: string): Promise<Response> {
	return await app.fetch(
		new Request("http://localhost:3001/api/info", {
			headers: origin ? { Origin: origin } : {},
		}),
	);
}

describe("CORS configuration", () => {
	beforeEach(() => {
		clearClients();
	});

	afterEach(() => {
		setAllowedOrigins(prevOrigins);
	});

	it("names no origin when the allowlist is empty", async () => {
		setAllowedOrigins(undefined);
		expect(
			(await request("http://evil.com")).headers.get("Access-Control-Allow-Origin"),
		).toBeNull();
	});

	it("names no origin when the request carries none", async () => {
		// A non-empty allowlist, or the test would pass against the very bug it
		// guards: answering a headerless request with the first allowlisted entry.
		setAllowedOrigins("https://snatch.example, https://other.example");
		expect((await request()).headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("echoes an origin that is on the allowlist", async () => {
		setAllowedOrigins("http://localhost:5173, https://snatch.example");
		const res = await request("https://snatch.example");
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://snatch.example");
	});

	it("never names an allowlisted origin to a caller outside the allowlist", async () => {
		setAllowedOrigins("https://snatch.example, https://other.example");
		// The regression this guards: answering with the list's first entry would
		// tell evil.com that https://snatch.example is an allowed origin.
		expect(
			(await request("http://evil.com")).headers.get("Access-Control-Allow-Origin"),
		).toBeNull();
	});
});
