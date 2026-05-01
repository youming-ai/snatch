import { afterEach, describe, expect, it } from "bun:test";
import {
	downloadVideoStream,
	extractVideoInfo,
	resetYtDlpCommandForTest,
	setYtDlpCommandForTest,
} from "../src/lib/extractor";

afterEach(() => {
	resetYtDlpCommandForTest();
});

describe("extractVideoInfo", () => {
	it("should report stderr from non-zero yt-dlp exits", async () => {
		setYtDlpCommandForTest("false");

		await expect(extractVideoInfo("https://x.com/user/status/1234567890")).rejects.toThrow(
			"Extraction failed",
		);
	});
});

describe("downloadVideoStream", () => {
	it("should error the stream when yt-dlp exits unsuccessfully", async () => {
		setYtDlpCommandForTest("false");
		const stream = downloadVideoStream("https://x.com/user/status/1234567890");
		const reader = stream.getReader();

		await expect(reader.read()).rejects.toThrow("Download failed");
		reader.releaseLock();
	});
});
