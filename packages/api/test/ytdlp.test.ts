import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	buildChoices,
	cookiesArgs,
	downloadWithProgress,
	hasFfmpeg,
	probe,
	type VideoInfo,
} from "../src/lib/ytdlp";

const FIXTURE: VideoInfo = {
	id: "abc",
	title: "Sample",
	formats: [
		{ format_id: "audio", acodec: "opus", vcodec: "none", abr: 128 },
		{ format_id: "v360", vcodec: "avc1", acodec: "none", height: 360, tbr: 500 },
		{ format_id: "v720", vcodec: "avc1", acodec: "none", height: 720, tbr: 1500 },
		{ format_id: "v1080", vcodec: "avc1", acodec: "none", height: 1080, tbr: 3000 },
	],
};

const scripts: string[] = [];

/** Write an executable stand-in for the yt-dlp binary. */
async function fakeYtDlp(body: string): Promise<string> {
	const file = path.join(
		os.tmpdir(),
		`snatch-fake-${Date.now()}-${Math.random().toString(36).slice(2)}.sh`,
	);
	await fs.writeFile(file, `#!/bin/sh\n${body}\n`);
	await fs.chmod(file, 0o755);
	scripts.push(file);
	return file;
}

/** Consume a generator that is expected to produce no events. */
async function drain(generator: AsyncGenerator<unknown>): Promise<void> {
	let step = await generator.next();
	while (!step.done) step = await generator.next();
}

/** Run something expected to fail and hand back the error it threw. */
async function captureRejection(run: Promise<unknown>): Promise<Error> {
	try {
		await run;
	} catch (error) {
		if (error instanceof Error) return error;
		throw error;
	}
	throw new Error("expected the call to reject, but it resolved");
}

afterEach(async () => {
	await Promise.all(scripts.splice(0).map((file) => fs.rm(file, { force: true })));
});

describe("buildChoices", () => {
	it("defaults to all heights and mp3 audio", () => {
		const choices = buildChoices(FIXTURE);
		const video = choices.filter((c) => c.kind === "video").map((c) => c.quality);
		expect(video).toEqual(["1080p", "720p", "360p"]);
		expect(choices.find((c) => c.kind === "audio")?.id).toBe("a-mp3");
	});

	it("uses yoinks-style video labels", () => {
		const choices = buildChoices(FIXTURE);
		const video = choices.find((c) => c.quality === "1080p");
		expect(video?.label).toMatch(/^1080p · mp4/);
	});

	it("uses yoinks-style audio label", () => {
		const choices = buildChoices(FIXTURE);
		const audio = choices.find((c) => c.kind === "audio");
		expect(audio?.label).toMatch(/^audio only · mp3/);
	});
});

describe("probe", () => {
	it("surfaces the engine's own error text", async () => {
		const ytdlp = await fakeYtDlp('echo "ERROR: [youtube] Video unavailable" >&2; exit 1');
		await expect(probe(ytdlp, "https://example.com/v")).rejects.toThrow("Video unavailable");
	});

	it("rejects metadata it cannot parse", async () => {
		const ytdlp = await fakeYtDlp("echo not-json");
		await expect(probe(ytdlp, "https://example.com/v")).rejects.toThrow(/parse video metadata/i);
	});
});

describe("downloadWithProgress", () => {
	it("gives up on a transfer that stops producing output", async () => {
		const ytdlp = await fakeYtDlp("exec sleep 30");
		const events = downloadWithProgress(
			{ ytdlp, url: "https://example.com/v", args: [], idleTimeoutMs: 150 },
			undefined,
		);

		// Without the stall guard this would hold the child for the full sleep.
		await expect(drain(events)).rejects.toThrow(/stalled/i);
	});

	it("refuses to report success when no file was produced", async () => {
		// Exactly what a missing ffmpeg looks like from here: yt-dlp prints the
		// path it meant to write, exits 0, and leaves nothing on disk.
		const absent = path.join(os.tmpdir(), `snatch-absent-${Date.now()}-${Math.random()}.mp4`);
		const ytdlp = await fakeYtDlp(`echo "${absent}"; exit 0`);
		const events = downloadWithProgress(
			{ ytdlp, url: "https://example.com/v", args: [] },
			undefined,
		);

		const error = await captureRejection(drain(events));

		// The old behaviour resolved here, and the browser was then handed a
		// signed URL for a file that did not exist.
		expect(error.message).toMatch(/no file was produced/i);
		if (!(await hasFfmpeg())) expect(error.message).toMatch(/ffmpeg/i);
	});
});

describe("cookiesArgs", () => {
	const previous = process.env.YTDLP_COOKIES_FILE;

	async function withCookiesFile<T>(value: string | undefined, run: () => T): Promise<T> {
		if (value === undefined) delete process.env.YTDLP_COOKIES_FILE;
		else process.env.YTDLP_COOKIES_FILE = value;
		try {
			return run();
		} finally {
			if (previous === undefined) delete process.env.YTDLP_COOKIES_FILE;
			else process.env.YTDLP_COOKIES_FILE = previous;
		}
	}

	it("adds nothing when unconfigured", async () => {
		await withCookiesFile(undefined, () => {
			expect(cookiesArgs()).toEqual([]);
		});
	});

	it("passes a jar that exists", async () => {
		const jar = path.join(os.tmpdir(), `snatch-jar-${Date.now()}.txt`);
		await fs.writeFile(jar, "# Netscape HTTP Cookie File\n");
		try {
			await withCookiesFile(jar, () => {
				expect(cookiesArgs()).toEqual(["--cookies", jar]);
			});
		} finally {
			await fs.rm(jar, { force: true });
		}
	});

	it("stays out of the way when the path is wrong", async () => {
		// The boot log reports this; here the flag is simply omitted rather than
		// letting every yt-dlp invocation die on a bad path.
		await withCookiesFile("/nonexistent/snatch-cookies.txt", () => {
			expect(cookiesArgs()).toEqual([]);
		});
	});

	it("rejects a directory, which is what a botched Docker mount looks like", async () => {
		const asDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "snatch-jar-dir-"));
		try {
			await withCookiesFile(asDirectory, () => {
				expect(cookiesArgs()).toEqual([]);
			});
		} finally {
			await fs.rm(asDirectory, { recursive: true, force: true });
		}
	});

	it("reaches the spawned command", async () => {
		const jar = path.join(os.tmpdir(), `snatch-jar-${Date.now()}.txt`);
		const argLog = path.join(os.tmpdir(), `snatch-args-${Date.now()}.log`);
		await fs.writeFile(jar, "# Netscape HTTP Cookie File\n");
		const ytdlp = await fakeYtDlp(`printf '%s\\n' "$@" > ${argLog}`);
		try {
			await withCookiesFile(jar, async () => {
				await probe(ytdlp, "https://example.com/v").catch(() => {});
			});
			const args = await fs.readFile(argLog, "utf-8");
			expect(args).toContain("--cookies");
			expect(args).toContain(jar);
		} finally {
			await fs.rm(jar, { force: true });
			await fs.rm(argLog, { force: true });
		}
	});
});
