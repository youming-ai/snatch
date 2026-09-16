import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Every file snatch writes to the shared temp dir carries this prefix, so the
 * sweeper can reclaim its own debris without touching anything else on the host.
 */
export const TMP_PREFIX = "snatch-";

/** Files untouched for this long are garbage. */
export const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
/** A burst inside the TTL window is capped at this much disk. */
export const DEFAULT_MAX_BYTES = 4 * 1024 * 1024 * 1024;
/** Never evict a file touched this recently: it is mid-transfer. */
export const DEFAULT_GRACE_MS = 10 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

interface SweepOptions {
	ttlMs?: number;
	maxBytes?: number;
	graceMs?: number;
	/** Only tests pass this; production always sweeps the real temp dir. */
	dir?: string;
}

interface TmpFile {
	path: string;
	size: number;
	mtimeMs: number;
}

async function remove(file: string): Promise<boolean> {
	try {
		await fs.rm(file, { force: true });
		return true;
	} catch {
		return false;
	}
}

/**
 * Filename prefixes owned by an in-flight job.
 *
 * The sweeper is offline and can only see mtimes, so it cannot tell a fragment a
 * running yt-dlp is about to merge from one that was abandoned: the first stream
 * of a two-stream download stops being touched while the second one downloads, so
 * a job that runs long enough would have its finished half deleted before the
 * merge. Registering the job's output prefix keeps the sweeper off everything that
 * job will still need, including the fragments whose names it never sees.
 */
const inUsePrefixes = new Set<string>();

/** Mark a filename prefix as belonging to a live job. Returns the release. */
export function markTmpInUse(prefix: string): () => void {
	inUsePrefixes.add(prefix);
	return () => {
		inUsePrefixes.delete(prefix);
	};
}

function isInUse(name: string): boolean {
	for (const prefix of inUsePrefixes) {
		if (name.startsWith(prefix)) return true;
	}
	return false;
}

/**
 * Reclaim snatch's temp files.
 *
 * The files are normally deleted by whichever path created them: probe metadata
 * once the progress stream has consumed it, and the media file once
 * `/api/download` has served it. This is the safety net for the paths that never
 * reach their cleanup — a resolve whose download was never followed, a stream the
 * client abandoned mid-flight, a request that died. Without it, `/api/resolve`
 * traffic alone fills the disk, since every probe writes a JSON file.
 *
 * Two passes, both offline and both bounded:
 *
 * 1. **Age** — anything untouched for `ttlMs` is garbage, so delete it.
 * 2. **Size** — a burst inside the TTL window can still outgrow the disk, so
 *    evict the oldest idle files until the total is back under `maxBytes`.
 *    Files touched within `graceMs` are spared: yt-dlp rewrites the `.part`
 *    file's mtime continuously, so a long transfer survives both passes.
 *
 * Files registered through `markTmpInUse` are skipped by both passes. Only files
 * carrying `TMP_PREFIX` are considered. Returns how many were removed.
 */
export async function cleanupStaleFiles({
	ttlMs = DEFAULT_TTL_MS,
	maxBytes = DEFAULT_MAX_BYTES,
	graceMs = DEFAULT_GRACE_MS,
	dir = os.tmpdir(),
}: SweepOptions = {}): Promise<number> {
	let entries: string[];
	try {
		entries = await fs.readdir(dir);
	} catch {
		return 0;
	}

	const files: TmpFile[] = [];
	await Promise.all(
		entries
			.filter((name) => name.startsWith(TMP_PREFIX) && !isInUse(name))
			.map(async (name) => {
				const file = path.join(dir, name);
				try {
					const stat = await fs.stat(file);
					if (stat.isFile()) files.push({ path: file, size: stat.size, mtimeMs: stat.mtimeMs });
				} catch {
					// vanished between readdir and stat — nothing to do
				}
			}),
	);

	const now = Date.now();
	let removed = 0;
	const live: TmpFile[] = [];

	for (const file of files) {
		if (now - file.mtimeMs > ttlMs) {
			if (await remove(file.path)) removed++;
		} else {
			live.push(file);
		}
	}

	let total = live.reduce((sum, file) => sum + file.size, 0);
	if (total > maxBytes) {
		const evictable = live
			.filter((file) => now - file.mtimeMs > graceMs)
			.sort((a, b) => a.mtimeMs - b.mtimeMs);
		for (const file of evictable) {
			if (total <= maxBytes) break;
			if (await remove(file.path)) {
				total -= file.size;
				removed++;
			}
		}
	}

	return removed;
}

interface TmpCleanupOptions {
	ttlMs?: number;
	maxBytes?: number;
	onSweep?: (removed: number) => void;
}

/**
 * Sweep immediately, then on an interval. Returns a disposer. The timer is
 * unref'd so an idle server can still exit on its own.
 */
export function startTmpCleanup({ ttlMs, maxBytes, onSweep }: TmpCleanupOptions = {}): () => void {
	const sweep = () => {
		void cleanupStaleFiles({ ttlMs, maxBytes }).then((removed) => {
			if (removed > 0) onSweep?.(removed);
		});
	};

	sweep();
	const timer = setInterval(sweep, DEFAULT_INTERVAL_MS);
	timer.unref();
	return () => clearInterval(timer);
}
