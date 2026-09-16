import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { accessSync, constants, createWriteStream, statSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { markTmpInUse, TMP_PREFIX } from "./tmp-cleanup";

const SNATCH_DIR = process.env.YTDLP_DIR || path.join(os.homedir(), ".snatch", "bin");
const RELEASE_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
/** A provisioning attempt that stalls this long is abandoned for the next retry. */
const PROVISION_TIMEOUT_MS = 120_000;

// Shares the sweeper's prefix so probe metadata is always coverable by
// `cleanupStaleFiles`, even if the request that wrote it never cleans up.
const INFO_JSON_PREFIX = `${TMP_PREFIX}info-`;

/** Distinguishes concurrent writes that land inside the same millisecond. */
function uniqueSuffix(): string {
	return randomUUID().slice(0, 8);
}

function ytDlpAssetName(): string {
	if (process.platform === "win32") return "yt-dlp.exe";
	if (process.platform === "darwin") return "yt-dlp_macos";
	return process.arch === "arm64" ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
}

function commandWorks(cmd: string, args: string[]): Promise<boolean> {
	const { promise, resolve } = Promise.withResolvers<boolean>();
	let child: ChildProcess;
	try {
		child = spawn(cmd, args, { stdio: "ignore", timeout: 10_000 });
	} catch {
		return Promise.resolve(false);
	}
	child.on("error", () => resolve(false));
	child.on("close", (code) => resolve(code === 0));
	return promise;
}

let ffmpegCheck: Promise<boolean> | null = null;

/**
 * Whether `ffmpeg` is runnable, checked once per process.
 *
 * Every format this app offers is built from separate video and audio streams on
 * most sites, so ffmpeg is what performs the merge (and the mp3 extraction).
 * Without it yt-dlp still exits 0 and prints the path it meant to write, which is
 * why the absence has to be detected here rather than inferred from the exit code.
 */
export function hasFfmpeg(): Promise<boolean> {
	ffmpegCheck ??= commandWorks("ffmpeg", ["-version"]);
	return ffmpegCheck;
}

/**
 * The cookie jar to hand yt-dlp, or `null` when there is none to use.
 *
 * Many sites refuse a datacenter IP outright — YouTube answers a cloud host with
 * "Sign in to confirm you're not a bot" — and the supported workaround is a
 * cookie jar exported from a logged-in browser. The path comes from
 * `YTDLP_COOKIES_FILE`. Re-checked per spawn rather than cached, so a jar dropped
 * in later takes effect without a restart.
 *
 * A directory is rejected on purpose: that is what a Docker bind mount of a
 * missing host file looks like, and passing it to `--cookies` would fail every
 * download instead of just the ones that need a login.
 */
export function usableCookiesFile(): string | null {
	const configured = process.env.YTDLP_COOKIES_FILE?.trim();
	if (!configured) return null;
	try {
		if (!statSync(configured).isFile()) return null;
		// Readability matters as much as existence: a jar the service account
		// cannot open would be handed to every child, and each authenticated
		// probe would fail with yt-dlp's error instead of the boot warning that
		// says the configuration is wrong.
		accessSync(configured, constants.R_OK);
		return configured;
	} catch {
		return null;
	}
}

/** `--cookies <file>`, or nothing when no usable jar is configured. */
export function cookiesArgs(): string[] {
	const jar = usableCookiesFile();
	return jar ? ["--cookies", jar] : [];
}

/**
 * yt-dlp prints the path it *intended* to produce, and a post-processing step
 * that could not run — a merge needing a missing ffmpeg, most often — leaves the
 * exit code at 0 with nothing on disk. Signing a URL for that path hands the
 * browser a 404 it cannot explain, so prove the file exists first.
 */
async function confirmProducedFile(filePath: string): Promise<void> {
	try {
		await fs.stat(filePath);
		return;
	} catch {
		const hint = (await hasFfmpeg())
			? ""
			: " This host has no ffmpeg, which is required to merge video and audio.";
		throw new Error(`The download finished but no file was produced.${hint}`);
	}
}

/** The in-flight provisioning attempt, shared by every concurrent caller. */
let provisioning: Promise<string> | null = null;

/**
 * Resolve a usable yt-dlp binary: system install first, then cached download,
 * then fetch the standalone binary from GitHub releases.
 *
 * The release is deliberately unpinned: yt-dlp ships extractor fixes constantly
 * and a pinned build rots as sites change. Operators who want a fixed binary put
 * it on `PATH` or in `YTDLP_DIR`, both of which are preferred over downloading.
 *
 * Takes no signal on purpose — see the note on the shared attempt below.
 */
export async function ensureYtDlp(): Promise<string> {
	if (await commandWorks("yt-dlp", ["--version"])) return "yt-dlp";

	const local = path.join(SNATCH_DIR, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
	if (await commandWorks(local, ["--version"])) return local;

	// One provision at a time. Concurrent callers await the same attempt instead
	// of racing to write the same temp file, and a failure clears the slot so a
	// later request can retry rather than inheriting the first one's bad luck.
	//
	// The attempt is deliberately not cancellable by whoever triggered it: it is
	// shared process-wide, so binding it to one caller's signal would let a
	// client that closed its tab fail provisioning for every other waiter. It
	// carries its own deadline instead.
	provisioning ??= provisionYtDlp(local, AbortSignal.timeout(PROVISION_TIMEOUT_MS)).finally(() => {
		provisioning = null;
	});
	return provisioning;
}

async function provisionYtDlp(local: string, signal?: AbortSignal): Promise<string> {
	await fs.mkdir(SNATCH_DIR, { recursive: true });

	const url = `${RELEASE_BASE}/${ytDlpAssetName()}`;
	const response = await fetch(url, { signal });
	if (!response.ok || !response.body) {
		throw new Error(`Could not download yt-dlp (${response.status}). Check network connection.`);
	}

	// A fixed temp name is safe under the mutex above, and a transfer killed
	// mid-flight is overwritten by the next attempt instead of piling up.
	const tmp = `${local}.download`;
	await pipeline(
		Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
		createWriteStream(tmp),
		{ signal },
	);
	await fs.chmod(tmp, 0o755);

	// Prove the binary runs before it is published at `local`: a truncated or
	// garbage transfer must never become the cached engine for every later
	// request, which is the failure the cache would otherwise make permanent.
	if (!(await commandWorks(tmp, ["--version"]))) {
		await fs.rm(tmp, { force: true });
		throw new Error("Downloaded yt-dlp binary failed to run; refusing to cache it.");
	}

	await fs.rename(tmp, local);
	return local;
}

interface RawFormat {
	format_id: string;
	ext?: string;
	vcodec?: string;
	acodec?: string;
	height?: number;
	width?: number;
	abr?: number;
	tbr?: number;
	filesize?: number;
	filesize_approx?: number;
}

export interface VideoInfo {
	id: string;
	title: string;
	uploader?: string;
	duration?: number;
	thumbnail?: string;
	webpage_url?: string;
	extractor_key?: string;
	formats?: RawFormat[];
}

function isRawFormat(value: unknown): value is RawFormat {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as RawFormat).format_id === "string"
	);
}

/** Parse and shape-validate untrusted yt-dlp JSON into a VideoInfo. */
export function parseVideoInfo(raw: string): VideoInfo {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		throw new Error("Could not parse video metadata from yt-dlp.");
	}
	if (typeof data !== "object" || data === null) {
		throw new Error("Unexpected video metadata shape from yt-dlp.");
	}
	const obj = data as Record<string, unknown>;
	return {
		id: typeof obj.id === "string" ? obj.id : "",
		title: typeof obj.title === "string" ? obj.title : "",
		uploader: typeof obj.uploader === "string" ? obj.uploader : undefined,
		duration: typeof obj.duration === "number" ? obj.duration : undefined,
		thumbnail: typeof obj.thumbnail === "string" ? obj.thumbnail : undefined,
		webpage_url: typeof obj.webpage_url === "string" ? obj.webpage_url : undefined,
		extractor_key: typeof obj.extractor_key === "string" ? obj.extractor_key : undefined,
		formats: Array.isArray(obj.formats) ? obj.formats.filter(isRawFormat) : undefined,
	};
}

interface ProbeResult {
	info: VideoInfo;
	infoJsonPath: string;
}

interface DownloadChoice {
	id: string;
	label: string;
	kind: "video" | "audio";
	quality?: string;
	ext: string;
	args: string[];
	sizeLabel?: string;
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

/** A probe that has not answered in this long is stuck, not slow. */
const PROBE_TIMEOUT_MS = 60_000;
/** Ceiling on a metadata dump, so an unexpected extractor cannot exhaust memory. */
const MAX_INFO_BYTES = 16 * 1024 * 1024;

export async function probe(
	ytdlp: string,
	url: string,
	signal?: AbortSignal,
): Promise<ProbeResult> {
	const timeout = AbortSignal.timeout(PROBE_TIMEOUT_MS);
	const { promise, resolve, reject } = Promise.withResolvers<string>();
	const child = spawn(ytdlp, ["-J", "--no-playlist", "--no-warnings", ...cookiesArgs(), url], {
		signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
	});
	let out = "";
	let stderr = "";
	child.stdout.on("data", (chunk) => {
		out += chunk;
		if (out.length > MAX_INFO_BYTES) {
			child.kill("SIGKILL");
			reject(new Error("yt-dlp returned more metadata than expected."));
		}
	});
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});
	child.on("error", (error) => {
		// The abort may have come from our own deadline rather than the client.
		reject(
			timeout.aborted ? new Error(`yt-dlp timed out after ${PROBE_TIMEOUT_MS / 1000}s.`) : error,
		);
	});
	child.on("close", (code) => {
		if (code !== 0) {
			reject(new Error(cleanYtDlpError(stderr) || `yt-dlp probe failed (exit code ${code})`));
		} else {
			resolve(out);
		}
	});

	const stdout = await promise;
	const info = parseVideoInfo(stdout);

	const infoJsonPath = path.join(
		os.tmpdir(),
		`${INFO_JSON_PREFIX}${process.pid}-${Date.now()}-${uniqueSuffix()}.json`,
	);
	await fs.writeFile(infoJsonPath, stdout);
	return { info, infoJsonPath };
}

const MAX_VIDEO_CHOICES = 8;

export function buildChoices(info: VideoInfo): DownloadChoice[] {
	const formats = info.formats ?? [];
	const choices: DownloadChoice[] = [];

	const audioOnly = formats.filter(
		(f) => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none"),
	);
	const bestAudio = [...audioOnly].sort((a, b) => (b.abr ?? b.tbr ?? 0) - (a.abr ?? a.tbr ?? 0))[0];
	const audioSize = bestAudio?.filesize ?? bestAudio?.filesize_approx;

	const videos = formats.filter((f) => f.vcodec && f.vcodec !== "none" && f.height);
	const heights = [...new Set(videos.map((f) => f.height as number))].sort((a, b) => b - a);

	for (const height of heights.slice(0, MAX_VIDEO_CHOICES)) {
		const candidates = videos.filter((f) => f.height === height);
		const best = [...candidates].sort((a, b) => scoreVideo(b) - scoreVideo(a))[0];
		const muxed = best.acodec && best.acodec !== "none";
		const size = (best.filesize ?? best.filesize_approx ?? 0) + (muxed ? 0 : (audioSize ?? 0));
		const sizeLabel = size > 0 ? formatBytes(size) : undefined;
		const ext = "mp4";

		choices.push({
			id: `v-${height}p`,
			kind: "video",
			quality: `${height}p`,
			ext,
			label: `${height}p · ${ext}${sizeLabel ? ` · ~${sizeLabel}` : ""}`,
			sizeLabel,
			args: [
				"-f",
				`bv*[height=${height}]+ba/b[height=${height}]/bv*[height<=${height}]+ba/b`,
				"--merge-output-format",
				"mp4",
			],
		});
	}

	if (choices.length === 0) {
		choices.push({
			id: "v-best",
			kind: "video",
			quality: "best",
			ext: "mp4",
			label: "best available · mp4",
			args: ["-f", "bv*+ba/b", "--merge-output-format", "mp4"],
		});
	}

	const audioSizeLabel = audioSize ? formatBytes(audioSize) : undefined;
	choices.push({
		id: "a-mp3",
		kind: "audio",
		quality: "mp3",
		ext: "mp3",
		label: `audio only · mp3${audioSizeLabel ? ` · ~${audioSizeLabel}` : ""}`,
		sizeLabel: audioSizeLabel,
		args: ["-f", "ba/b", "-x", "--audio-format", "mp3", "--audio-quality", "0"],
	});

	return choices;
}
function scoreVideo(f: RawFormat): number {
	let score = f.tbr ?? 0;
	if (f.ext === "mp4") score += 10_000;
	if (f.vcodec?.startsWith("avc")) score += 5_000;
	return score;
}

interface ExecuteDownloadOptions {
	ytdlp: string;
	url: string;
	infoJsonPath?: string;
	args: string[];
	/** Overridable so a test need not sit out the real stall window. */
	idleTimeoutMs?: number;
}

export type DownloadProgressEvent = {
	kind: "progress";
	downloadedBytes: number;
	totalBytes?: number;
	speed?: number;
	eta?: number;
	part: number;
	totalParts: number;
};

export type DownloadProcessingEvent = {
	kind: "processing";
};

export type DownloadEvent = DownloadProgressEvent | DownloadProcessingEvent;

const PROGRESS_PREFIX = "YOINK|";
const PROGRESS_TEMPLATE = `${PROGRESS_PREFIX}%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s`;

/**
 * Silence for this long means the transfer has stalled.
 *
 * A stall is the failure worth catching: yt-dlp prints progress continuously
 * while it works, so a dead connection would otherwise hold a child, its part
 * file, and the client's socket open indefinitely. A slow-but-live transfer
 * keeps printing and is never cut off — which is why there is deliberately no
 * total-duration cap on a download.
 */
const DOWNLOAD_IDLE_TIMEOUT_MS = 120_000;

/**
 * Budget for the merge / audio-extraction step, which is silent by nature.
 *
 * yt-dlp does not forward ffmpeg's progress, so a large merge would look exactly
 * like a dead connection. It is not unbounded either: a wedged ffmpeg must not
 * hold a child forever.
 */
const POST_PROCESS_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Stream yt-dlp download events and return the final file path. Mirrors yoinks'
 * progress parsing: live bytes/speed/ETA while downloading, processing events
 * during merge/audio extraction, and the resolved filepath once complete.
 */
export async function* downloadWithProgress(
	opts: ExecuteDownloadOptions,
	signal?: AbortSignal,
): AsyncGenerator<DownloadEvent, { filePath: string; cleanup: () => Promise<void> }> {
	const outDir = os.tmpdir();
	// The suffix keeps two downloads started in the same millisecond (and with
	// the same video title) from writing to one file and clobbering each other.
	const outPattern = path.join(
		outDir,
		`${TMP_PREFIX}${Date.now()}-${uniqueSuffix()}-%(title).60s.%(ext)s`,
	);
	// Everything this job writes shares this prefix — the final file and the
	// per-stream fragments whose names yt-dlp chooses on its own — so the sweeper
	// leaves all of it alone until the job is done with it.
	const releaseOutput = markTmpInUse(path.basename(outPattern).split("%")[0] ?? TMP_PREFIX);
	const args = [
		...(opts.infoJsonPath ? ["--load-info-json", opts.infoJsonPath] : [opts.url]),
		...cookiesArgs(),
		...opts.args,
		"--no-playlist",
		"--no-warnings",
		"--newline",
		"--no-quiet",
		"--progress",
		"--progress-template",
		`download:${PROGRESS_TEMPLATE}`,
		"--print",
		"after_move:filepath",
		"--no-simulate",
		"-o",
		outPattern,
	];

	const { promise, resolve, reject } = Promise.withResolvers<{
		filePath: string;
		cleanup: () => Promise<void>;
	}>();
	const child = spawn(opts.ytdlp, args, { signal });
	let stderr = "";
	let filepath = "";
	let completed = false;
	let timedOut = false;
	let postProcessing = false;
	let part = 0;
	let totalParts = 1;
	let lastDownloaded = 0;
	let buffer = "";
	const destinations: string[] = [];

	// Any output resets the stall clock, so only a genuinely silent child is killed.
	const idleTimeoutMs = opts.idleTimeoutMs ?? DOWNLOAD_IDLE_TIMEOUT_MS;
	let stalledAfterMs = idleTimeoutMs;
	let idleTimer: ReturnType<typeof setTimeout> | undefined;

	const armIdle = (ms: number) => {
		stalledAfterMs = ms;
		clearTimeout(idleTimer);
		idleTimer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
		}, ms);
		idleTimer.unref();
	};
	armIdle(idleTimeoutMs);

	// Output means the transfer is alive. Once yt-dlp has handed the file over to
	// ffmpeg it stops printing progress — the postprocessor's own output is not
	// forwarded — so that phase gets its own, far larger budget rather than the
	// "no bytes for two minutes" one, which would kill a legitimate merge.
	const touchIdle = () => armIdle(postProcessing ? POST_PROCESS_TIMEOUT_MS : idleTimeoutMs);

	const eventQueue: DownloadEvent[] = [];
	let eventResolver: ((value?: unknown) => void) | undefined;

	function pushEvent(event: DownloadEvent) {
		eventQueue.push(event);
		eventResolver?.();
		eventResolver = undefined;
	}

	child.stdout.on("data", (chunk: Buffer) => {
		touchIdle();
		buffer += chunk.toString();
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const rawLine of lines) {
			const line = rawLine.trim();
			if (!line) continue;
			if (line.startsWith(PROGRESS_PREFIX)) {
				const [downloaded, total, totalEstimate, speed, eta] = line
					.slice(PROGRESS_PREFIX.length)
					.split("|");
				const downloadedBytes = toNumber(downloaded) ?? 0;
				if (downloadedBytes < lastDownloaded) part++;
				lastDownloaded = downloadedBytes;
				pushEvent({
					kind: "progress",
					downloadedBytes,
					totalBytes: toNumber(total) ?? toNumber(totalEstimate),
					speed: toNumber(speed),
					eta: toNumber(eta),
					part,
					totalParts,
				});
			} else if (line.includes("Downloading 1 format(s):")) {
				totalParts = (line.split("format(s):")[1] ?? "").trim().split("+").length;
			} else if (line.includes("[Merger]") || line.includes("[ExtractAudio]")) {
				const merging = /^\[Merger\] Merging formats into "(.+)"$/.exec(line)?.[1];
				const extracting = /^\[ExtractAudio\] Destination: (.+)$/.exec(line)?.[1];
				const target = merging ?? extracting;
				if (target) destinations.push(target);
				// From here the child is waiting on ffmpeg, not on the network.
				postProcessing = true;
				armIdle(POST_PROCESS_TIMEOUT_MS);
				pushEvent({ kind: "processing" });
			} else if (line.startsWith("[download] Destination: ")) {
				destinations.push(line.slice("[download] Destination: ".length));
			} else if (path.isAbsolute(line)) {
				filepath = line;
			}
		}
	});

	child.stderr.on("data", (chunk) => {
		touchIdle();
		stderr += chunk;
	});

	child.on("error", (error) => {
		clearTimeout(idleTimer);
		reject(error);
	});
	child.on("close", (code) => {
		clearTimeout(idleTimer);
		if (signal?.aborted) {
			void removeFiles(destinations);
			reject(new Error("Download cancelled."));
			return;
		}
		if (timedOut) {
			void removeFiles(destinations);
			reject(
				new Error(
					postProcessing
						? `Post-processing (merge or audio extraction) did not finish within ${Math.round(
								stalledAfterMs / 60_000,
							)}min.`
						: `Download stalled: no output for ${Math.round(stalledAfterMs / 1000)}s.`,
				),
			);
			return;
		}
		if (code === 0 && filepath) {
			confirmProducedFile(filepath).then(
				() => {
					completed = true;
					const cleanup = async () => {
						const filesToRemove = [filepath, ...destinations];
						await removeFiles(filesToRemove);
					};
					resolve({ filePath: filepath, cleanup });
				},
				(error) => {
					void removeFiles(destinations);
					reject(error);
				},
			);
			return;
		}
		void removeFiles(destinations);
		reject(new Error(cleanYtDlpError(stderr) || `Download failed (exit code ${code}).`));
	});

	try {
		while (true) {
			if (eventQueue.length > 0) {
				const event = eventQueue.shift();
				if (event) {
					yield event;
					continue;
				}
			}
			await new Promise<unknown>((resolveWait) => {
				eventResolver = resolveWait;
				// also resolve when the process promise settles so we can return
				void promise.then(resolveWait, resolveWait);
			});
			if (eventQueue.length === 0) break;
		}
		return await promise;
	} finally {
		clearTimeout(idleTimer);
		releaseOutput();
		// only kill+clean if the consumer abandoned the generator early
		if (!completed && !child.killed) {
			child.kill("SIGTERM");
			void removeFiles(destinations);
		}
	}
}

function toNumber(value: string | undefined): number | undefined {
	if (!value || value === "NA" || value === "None") return undefined;
	const n = Number.parseFloat(value);
	return Number.isFinite(n) ? n : undefined;
}

function removeFiles(files: string[]): Promise<unknown> {
	const set = new Set(files.flatMap((f) => [f, `${f}.part`, `${f}.ytdl`]));
	return Promise.allSettled(Array.from(set).map((file) => fs.rm(file, { force: true })));
}

function cleanYtDlpError(stderr: string): string {
	const lines = stderr
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.startsWith("ERROR:"));
	const last = lines.at(-1);
	return last ? last.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/, "") : stderr.trim();
}
