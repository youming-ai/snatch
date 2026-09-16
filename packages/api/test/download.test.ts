import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Context } from "hono";
import app from "../src/app";
import { signUrl } from "../src/lib/security";
import { clearClients } from "../src/middleware/rate-limit";

// The route and the test must agree on the HMAC key; `signUrl` resolves it from
// the environment, exactly as the server does at request time.
process.env.PROXY_SIGNING_KEY = "test-key";

const tempFiles: string[] = [];

async function preparedFile(name: string, body = "0123456789"): Promise<string> {
	const file = path.join(
		os.tmpdir(),
		`snatch-test-${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`,
	);
	await fs.writeFile(file, body);
	tempFiles.push(file);
	return file;
}

/**
 * Sign a delivery URL the way the progress endpoint does. `signUrl` only uses
 * the context to reach `env()`, which on Bun reads `process.env` — so the
 * signature here is the one the route will verify.
 */
function downloadUrl(file: string): string {
	const sig = signUrl(JSON.stringify([file]), {} as Context);
	return `http://localhost:3001/api/download?file=${encodeURIComponent(file)}&sig=${sig}`;
}

async function exists(file: string): Promise<boolean> {
	return fs
		.stat(file)
		.then(() => true)
		.catch(() => false);
}

async function waitForRemoval(file: string): Promise<boolean> {
	for (let attempt = 0; attempt < 100; attempt++) {
		if (!(await exists(file))) return true;
		await Bun.sleep(10);
	}
	return false;
}

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

	it("returns 400 when the host is private or internal", async () => {
		const res = await app.fetch(
			new Request("http://localhost:3001/api/resolve", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data/" }),
			}),
		);
		expect(res.status).toBe(400);
	});
});

describe("GET /api/download delivery", () => {
	beforeEach(() => {
		clearClients();
	});

	afterEach(async () => {
		await Promise.all(tempFiles.splice(0).map((file) => fs.rm(file, { force: true })));
	});

	it("streams the whole file and then reclaims it", async () => {
		const file = await preparedFile("video.mp4");

		const res = await app.fetch(new Request(downloadUrl(file)));

		expect(res.status).toBe(200);
		expect(res.headers.get("Accept-Ranges")).toBe("bytes");
		expect(res.headers.get("Content-Length")).toBe("10");
		expect(await res.text()).toBe("0123456789");
		expect(await waitForRemoval(file)).toBe(true);
	});

	it("answers a byte range with 206 and only that slice", async () => {
		const file = await preparedFile("video.mp4");

		const res = await app.fetch(
			new Request(downloadUrl(file), { headers: { Range: "bytes=2-5" } }),
		);

		expect(res.status).toBe(206);
		expect(res.headers.get("Content-Range")).toBe("bytes 2-5/10");
		expect(res.headers.get("Content-Length")).toBe("4");
		expect(await res.text()).toBe("2345");
		// A partial read must leave the file for the resume it implies.
		expect(await exists(file)).toBe(true);
	});

	it("answers a suffix range from the end of the file", async () => {
		const file = await preparedFile("video.mp4");

		const res = await app.fetch(new Request(downloadUrl(file), { headers: { Range: "bytes=-3" } }));

		expect(res.status).toBe(206);
		expect(res.headers.get("Content-Range")).toBe("bytes 7-9/10");
		expect(await res.text()).toBe("789");
		// It ends at EOF but never delivered bytes 0-6, so deleting here would 404
		// the very request that range was serving.
		expect(await exists(file)).toBe(true);
	});

	it("reclaims the file after a range that covers it from byte 0", async () => {
		const file = await preparedFile("video.mp4");

		const res = await app.fetch(new Request(downloadUrl(file), { headers: { Range: "bytes=0-" } }));

		expect(res.status).toBe(206);
		expect(res.headers.get("Content-Range")).toBe("bytes 0-9/10");
		expect(await res.text()).toBe("0123456789");
		// Byte 0 to EOF is the whole file, so this is a complete delivery.
		expect(await waitForRemoval(file)).toBe(true);
	});

	it("refuses a range past the end with 416 and the file size", async () => {
		const file = await preparedFile("video.mp4");

		const res = await app.fetch(
			new Request(downloadUrl(file), { headers: { Range: "bytes=50-60" } }),
		);

		expect(res.status).toBe(416);
		expect(res.headers.get("Content-Range")).toBe("bytes */10");
		expect(await exists(file)).toBe(true);
	});

	it("carries a non-ASCII filename in both forms", async () => {
		const file = await preparedFile("视频.mp4");

		const res = await app.fetch(new Request(downloadUrl(file)));
		const disposition = res.headers.get("Content-Disposition") ?? "";

		expect(disposition).toContain('filename="');
		expect(disposition).toContain("filename*=UTF-8''");
		const encoded = disposition.split("filename*=UTF-8''")[1] ?? "";
		expect(decodeURIComponent(encoded)).toContain("视频.mp4");

		await res.text();
	});
});
