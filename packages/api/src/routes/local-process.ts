import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Hono } from "hono";
import { env } from "hono/adapter";
import { stream } from "hono/streaming";
import { isSafeUrl, sanitizeFilename, verifyUrl } from "../lib/security";

const localProcessRouter = new Hono();

localProcessRouter.get("/api/local-process", async (c) => {
	const tunnelsParam = c.req.query("tunnels");
	const signature = c.req.query("sig");
	const type = c.req.query("type") || "merge";
	const filename = c.req.query("filename") || "video.mp4";

	if (!tunnelsParam || !signature) {
		return c.json({ success: false, error: "Missing required parameters" }, 400);
	}

	if (!verifyUrl(tunnelsParam, signature, c)) {
		return c.json({ success: false, error: "Invalid signature" }, 403);
	}

	let tunnels: string[];
	try {
		tunnels = JSON.parse(tunnelsParam);
	} catch {
		return c.json({ success: false, error: "Invalid tunnels parameter format" }, 400);
	}

	const cobaltUrl = (env(c).COBALT_API_URL as string | undefined) || "http://localhost:9000";
	for (const url of tunnels) {
		if (!isSafeUrl(url, cobaltUrl)) {
			return c.json({ success: false, error: "Forbidden segment URL" }, 403);
		}
	}

	const tempInputs: string[] = [];
	const outputFilename = `snatch-out-${crypto.randomUUID()}-${filename}`;
	const outputPath = path.join(os.tmpdir(), outputFilename);

	try {
		for (const url of tunnels) {
			const res = await fetch(url, { signal: c.req.raw.signal });
			if (!res.ok) {
				throw new Error(`failed to fetch tunnel segment: HTTP ${res.status}`);
			}
			const tempInputPath = path.join(os.tmpdir(), `snatch-in-${crypto.randomUUID()}`);
			await Bun.write(tempInputPath, res);
			tempInputs.push(tempInputPath);
		}

		let args: string[] = [];
		if (tempInputs.length === 2 && (type === "merge" || type === "remux")) {
			args = [
				"-y",
				"-i",
				tempInputs[0],
				"-i",
				tempInputs[1],
				"-c:v",
				"copy",
				"-c:a",
				"aac",
				"-map",
				"0:v:0",
				"-map",
				"1:a:0",
				outputPath,
			];
		} else if (tempInputs.length === 1 && type === "mute") {
			args = ["-y", "-i", tempInputs[0], "-an", "-c:v", "copy", outputPath];
		} else if (tempInputs.length === 1 && type === "audio") {
			args = ["-y", "-i", tempInputs[0], "-vn", "-c:a", "aac", outputPath];
		} else if (tempInputs.length === 1) {
			args = ["-y", "-i", tempInputs[0], "-c", "copy", outputPath];
		} else {
			throw new Error(`unsupported local processing: type=${type}, parts=${tempInputs.length}`);
		}

		const proc = Bun.spawn(["ffmpeg", ...args]);
		const exitCode = await proc.exited;
		if (exitCode !== 0) {
			const stderr = await new Response(proc.stderr).text().catch(() => "");
			throw new Error(`ffmpeg failed with exit code ${exitCode}: ${stderr}`);
		}

		const outputFile = Bun.file(outputPath);
		const size = outputFile.size;

		c.header("Content-Type", "application/octet-stream");
		c.header("Content-Disposition", `attachment; filename="${sanitizeFilename(filename)}"`);
		c.header("Content-Length", size.toString());

		return stream(c, async (s) => {
			const streamNode = outputFile.stream();
			const reader = streamNode.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					await s.write(value);
				}
			} finally {
				reader.releaseLock();
			}
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Local processing failed";
		return c.json({ success: false, error: msg }, 502);
	} finally {
		for (const p of tempInputs) {
			fs.promises.unlink(p).catch(() => {});
		}
		fs.promises.unlink(outputPath).catch(() => {});
	}
});

export { localProcessRouter };
