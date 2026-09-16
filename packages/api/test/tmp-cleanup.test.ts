import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cleanupStaleFiles, DEFAULT_GRACE_MS } from "../src/lib/tmp-cleanup";

let dir: string;

async function writeFile(name: string, bytes: number, ageMs: number): Promise<string> {
	const file = path.join(dir, name);
	await fs.writeFile(file, "x".repeat(bytes));
	const when = new Date(Date.now() - ageMs);
	await fs.utimes(file, when, when);
	return file;
}

async function exists(file: string): Promise<boolean> {
	return fs
		.stat(file)
		.then(() => true)
		.catch(() => false);
}

describe("cleanupStaleFiles", () => {
	beforeEach(async () => {
		dir = await fs.mkdtemp(path.join(os.tmpdir(), "snatch-sweep-"));
	});

	afterEach(async () => {
		await fs.rm(dir, { recursive: true, force: true });
	});

	it("removes snatch files older than the TTL", async () => {
		const old = await writeFile("snatch-old.mp4", 16, 3 * 60 * 60 * 1000);
		const fresh = await writeFile("snatch-new.mp4", 16, 1000);

		const removed = await cleanupStaleFiles({ dir, ttlMs: 60 * 60 * 1000 });

		expect(removed).toBe(1);
		expect(await exists(old)).toBe(false);
		expect(await exists(fresh)).toBe(true);
	});

	it("never touches a file it did not write", async () => {
		const foreign = await writeFile("someone-elses.tmp", 16, 3 * 60 * 60 * 1000);

		const removed = await cleanupStaleFiles({ dir, ttlMs: 60 * 60 * 1000 });

		expect(removed).toBe(0);
		expect(await exists(foreign)).toBe(true);
	});

	it("evicts the oldest idle files once the total exceeds the cap", async () => {
		const oldest = await writeFile("snatch-oldest.mp4", 100, 60 * 60 * 1000);
		const middle = await writeFile("snatch-middle.mp4", 100, 30 * 60 * 1000);
		const newest = await writeFile("snatch-newest.mp4", 100, 20 * 60 * 1000);

		const removed = await cleanupStaleFiles({
			dir,
			ttlMs: 24 * 60 * 60 * 1000,
			maxBytes: 150,
		});

		expect(removed).toBe(2);
		expect(await exists(oldest)).toBe(false);
		expect(await exists(middle)).toBe(false);
		expect(await exists(newest)).toBe(true);
	});

	it("spares a transfer that is still writing", async () => {
		const inflight = await writeFile("snatch-inflight.mp4.part", 100, 0);
		const idle = await writeFile("snatch-idle.mp4", 100, 20 * 60 * 1000);

		const removed = await cleanupStaleFiles({
			dir,
			ttlMs: 24 * 60 * 60 * 1000,
			maxBytes: 150,
			graceMs: DEFAULT_GRACE_MS,
		});

		expect(removed).toBe(1);
		expect(await exists(inflight)).toBe(true);
		expect(await exists(idle)).toBe(false);
	});

	it("returns 0 when the directory is unreadable", async () => {
		expect(await cleanupStaleFiles({ dir: path.join(dir, "missing") })).toBe(0);
	});
});
