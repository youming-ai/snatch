import { describe, expect, it } from "bun:test";
import { sanitizeCobaltOptions } from "./cobalt";
import type { CobaltOptions } from "./types";

describe("sanitizeCobaltOptions", () => {
	it("passes through valid options unchanged", () => {
		const options: Partial<CobaltOptions> = {
			downloadMode: "audio",
			videoQuality: "1080",
			audioFormat: "mp3",
			audioBitrate: "128",
			filenameStyle: "basic",
			subtitleLang: "en",
			youtubeDubLang: "es",
		};
		expect(sanitizeCobaltOptions(options)).toEqual(options);
	});

	it("strips empty string optional fields", () => {
		const options: Partial<CobaltOptions> = {
			videoQuality: "max",
			audioFormat: "mp3",
			subtitleLang: "",
			youtubeDubLang: "   ",
		};
		expect(sanitizeCobaltOptions(options)).toEqual({
			videoQuality: "max",
			audioFormat: "mp3",
		});
	});

	it("strips undefined but keeps false and zero values", () => {
		const options: Partial<CobaltOptions> = {
			videoQuality: "max",
			disableMetadata: false,
			alwaysProxy: false,
			subtitleLang: undefined,
		};
		expect(sanitizeCobaltOptions(options)).toEqual({
			videoQuality: "max",
			disableMetadata: false,
			alwaysProxy: false,
		});
	});
});
