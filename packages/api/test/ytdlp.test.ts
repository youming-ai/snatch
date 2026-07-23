import { describe, expect, it } from "bun:test";
import { buildChoices, type VideoInfo } from "../src/lib/ytdlp";

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

describe("buildChoices", () => {
	it("honors a non-mp3 audioFormat in id and args", () => {
		const choices = buildChoices(FIXTURE, { audioFormat: "opus" });
		const audio = choices.find((c) => c.kind === "audio");
		expect(audio?.id).toBe("a-opus");
		expect(audio?.ext).toBe("opus");
		expect(audio?.args).toContain("opus");
	});

	it("returns only the audio choice in audio downloadMode", () => {
		const choices = buildChoices(FIXTURE, { downloadMode: "audio" });
		expect(choices.every((c) => c.kind === "audio")).toBe(true);
		expect(choices).toHaveLength(1);
	});

	it("caps video heights to videoQuality", () => {
		const choices = buildChoices(FIXTURE, { videoQuality: "720" });
		const heights = choices.filter((c) => c.kind === "video").map((c) => c.quality);
		expect(heights).toContain("720p");
		expect(heights).toContain("360p");
		expect(heights).not.toContain("1080p");
	});

	it("defaults to all heights and mp3 when no options given", () => {
		const choices = buildChoices(FIXTURE);
		const video = choices.filter((c) => c.kind === "video").map((c) => c.quality);
		expect(video).toEqual(["1080p", "720p", "360p"]);
		expect(choices.find((c) => c.kind === "audio")?.id).toBe("a-mp3");
	});
});
