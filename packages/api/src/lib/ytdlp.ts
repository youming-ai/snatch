import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { MediaOptions } from "@snatch/shared";

const SNATCH_DIR = process.env.YTDLP_DIR || path.join(os.homedir(), ".snatch", "bin");
const RELEASE_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

/** Prefix for the on-disk probe cache written by {@link probe}. */
const INFO_JSON_PREFIX = "snatch-info-";
/** Abandoned probe-cache files older than this are swept on the next probe. */
const INFO_JSON_TTL_MS = 30 * 60 * 1000;

/**
 * Delete stale probe-cache files left behind by /api/resolve calls that were
 * never followed by a download. Runs opportunistically on each probe, so no
 * background timer is needed.
 */
async function reapStaleInfoJson(dir: string): Promise<void> {
	const now = Date.now();
	let entries: string[];
	try {
		entries = await fs.readdir(dir);
	} catch {
		return;
	}
	await Promise.allSettled(
		entries
			.filter((name) => name.startsWith(INFO_JSON_PREFIX) && name.endsWith(".json"))
			.map(async (name) => {
				const full = path.join(dir, name);
				try {
					const st = await fs.stat(full);
					if (now - st.mtimeMs > INFO_JSON_TTL_MS) await fs.rm(full, { force: true });
				} catch {
					// already gone or unreadable — ignore
				}
			}),
	);
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

/**
 * Resolve a usable yt-dlp binary: system install first, then cached download,
 * then fetch standalone binary from GitHub releases.
 */
export async function ensureYtDlp(signal?: AbortSignal): Promise<string> {
	if (await commandWorks("yt-dlp", ["--version"])) return "yt-dlp";

	const local = path.join(SNATCH_DIR, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
	if (await commandWorks(local, ["--version"])) return local;

	await fs.mkdir(SNATCH_DIR, { recursive: true });

	const url = `${RELEASE_BASE}/${ytDlpAssetName()}`;
	const response = await fetch(url, { signal });
	if (!response.ok || !response.body) {
		throw new Error(`Could not download yt-dlp (${response.status}). Check network connection.`);
	}

	const tmp = `${local}.download`;
	await pipeline(
		Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
		createWriteStream(tmp),
		{ signal },
	);
	await fs.chmod(tmp, 0o755);
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

export async function probe(
	ytdlp: string,
	url: string,
	signal?: AbortSignal,
): Promise<ProbeResult> {
	const { promise, resolve, reject } = Promise.withResolvers<string>();
	const child = spawn(ytdlp, ["-J", "--no-playlist", "--no-warnings", url], { signal });
	let out = "";
	let stderr = "";
	child.stdout.on("data", (chunk) => {
		out += chunk;
	});
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});
	child.on("error", reject);
	child.on("close", (code) => {
		if (code !== 0) {
			reject(new Error(cleanYtDlpError(stderr) || `yt-dlp probe failed (exit code ${code})`));
		} else {
			resolve(out);
		}
	});

	const stdout = await promise;
	const info = parseVideoInfo(stdout);

	const tmpDir = os.tmpdir();
	await reapStaleInfoJson(tmpDir);
	const infoJsonPath = path.join(tmpDir, `${INFO_JSON_PREFIX}${process.pid}-${Date.now()}.json`);
	await fs.writeFile(infoJsonPath, stdout);
	return { info, infoJsonPath };
}

const MAX_VIDEO_CHOICES = 8;

export function buildChoices(
	info: VideoInfo,
	options?: Pick<MediaOptions, "audioFormat" | "videoQuality" | "downloadMode">,
): DownloadChoice[] {
	const formats = info.formats ?? [];
	const choices: DownloadChoice[] = [];
	const requestedAudioFmt = options?.audioFormat ?? "mp3";
	const audioOnly = options?.downloadMode === "audio";
	const maxHeight =
		options?.videoQuality && options.videoQuality !== "max"
			? Number.parseInt(options.videoQuality, 10)
			: undefined;

	const audioFormats = formats.filter(
		(f) => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none"),
	);
	const bestAudio = [...audioFormats].sort(
		(a, b) => (b.abr ?? b.tbr ?? 0) - (a.abr ?? a.tbr ?? 0),
	)[0];
	const audioSize = bestAudio?.filesize ?? bestAudio?.filesize_approx;

	if (!audioOnly) {
		const videos = formats.filter((f) => f.vcodec && f.vcodec !== "none" && f.height);
		let heights = [...new Set(videos.map((f) => f.height as number))].sort((a, b) => b - a);
		if (maxHeight !== undefined && Number.isFinite(maxHeight)) {
			heights = heights.filter((h) => h <= maxHeight);
		}

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
				label: `${height}p (${ext})${sizeLabel ? ` · ~${sizeLabel}` : ""}`,
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
			const cap = maxHeight !== undefined && Number.isFinite(maxHeight) ? maxHeight : undefined;
			choices.push({
				id: "v-best",
				kind: "video",
				quality: "best",
				ext: "mp4",
				label: cap ? `Best up to ${cap}p (mp4)` : "Best Quality (mp4)",
				args: [
					"-f",
					cap ? `bv*[height<=${cap}]+ba/b[height<=${cap}]/bv*+ba/b` : "bv*+ba/b",
					"--merge-output-format",
					"mp4",
				],
			});
		}
	}

	const audioSizeLabel = audioSize ? formatBytes(audioSize) : undefined;
	choices.push({
		id: `a-${requestedAudioFmt}`,
		kind: "audio",
		quality: requestedAudioFmt,
		ext: requestedAudioFmt,
		label: `Audio Only (${requestedAudioFmt})${audioSizeLabel ? ` · ~${audioSizeLabel}` : ""}`,
		sizeLabel: audioSizeLabel,
		args: ["-f", "ba/b", "-x", "--audio-format", requestedAudioFmt, "--audio-quality", "0"],
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
}

export async function executeDownload(
	opts: ExecuteDownloadOptions,
	signal?: AbortSignal,
): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
	const outPattern = path.join(os.tmpdir(), `snatch-${Date.now()}-%(title).60s.%(ext)s`);
	const args = [
		...(opts.infoJsonPath ? ["--load-info-json", opts.infoJsonPath] : [opts.url]),
		...opts.args,
		"--no-playlist",
		"--no-warnings",
		"--print",
		"after_move:filepath",
		"--no-simulate",
		"-o",
		outPattern,
	];

	const destinations: string[] = [];
	const { promise, resolve, reject } = Promise.withResolvers<{
		filePath: string;
		cleanup: () => Promise<void>;
	}>();
	const child = spawn(opts.ytdlp, args, { signal });
	const stdoutLines: string[] = [];
	let stderr = "";

	child.stdout.on("data", (chunk: Buffer) => {
		const text = chunk.toString().trim();
		for (const line of text.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			stdoutLines.push(trimmed);
			if (path.isAbsolute(trimmed)) {
				destinations.push(trimmed);
			}
		}
	});

	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});

	child.on("error", reject);
	child.on("close", (code) => {
		const filepath = stdoutLines.filter((l) => path.isAbsolute(l)).pop();

		if (signal?.aborted) {
			void removeFiles(destinations);
			reject(new Error("Download cancelled."));
			return;
		}
		if (code === 0 && filepath) {
			const cleanup = async () => {
				const filesToRemove = [filepath, ...destinations];
				if (opts.infoJsonPath) filesToRemove.push(opts.infoJsonPath);
				await removeFiles(filesToRemove);
			};
			resolve({ filePath: filepath, cleanup });
		} else {
			const filesToRemove = [...destinations];
			if (opts.infoJsonPath) filesToRemove.push(opts.infoJsonPath);
			void removeFiles(filesToRemove);
			reject(new Error(cleanYtDlpError(stderr) || `Download failed (exit code ${code})`));
		}
	});

	return promise;
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
