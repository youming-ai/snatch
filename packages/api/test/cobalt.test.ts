import { afterEach, describe, expect, it, mock } from "bun:test";
import {
	resetCobaltApiUrlForTest,
	resolveViaCobalt,
	setCobaltApiUrlForTest,
} from "../src/lib/cobalt";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	resetCobaltApiUrlForTest();
});

function mockCobalt(body: unknown, ok = true): void {
	globalThis.fetch = mock(
		async () => new Response(JSON.stringify(body), { status: ok ? 200 : 400 }),
	);
}

describe("resolveViaCobalt", () => {
	it("returns the url and filename for tunnel responses", async () => {
		setCobaltApiUrlForTest("http://cobalt:9000");
		mockCobalt({ status: "tunnel", url: "http://cobalt:9000/tunnel?id=1", filename: "clip.mp4" });

		const resolved = await resolveViaCobalt("https://x.com/user/status/1", "max");
		expect(resolved).toEqual({ url: "http://cobalt:9000/tunnel?id=1", filename: "clip.mp4" });
	});

	it("returns the url for redirect responses", async () => {
		mockCobalt({ status: "redirect", url: "https://cdn.example/v.mp4", filename: "v.mp4" });
		const resolved = await resolveViaCobalt("https://x.com/user/status/1", "max");
		expect(resolved.url).toBe("https://cdn.example/v.mp4");
	});

	it("picks the first video item from a picker response", async () => {
		mockCobalt({
			status: "picker",
			picker: [
				{ type: "photo", url: "https://cdn.example/p.jpg" },
				{ type: "video", url: "https://cdn.example/v.mp4" },
			],
		});
		const resolved = await resolveViaCobalt("https://tiktok.com/@u/video/1", "max");
		expect(resolved.url).toBe("https://cdn.example/v.mp4");
	});

	it("throws on cobalt error responses", async () => {
		mockCobalt({ status: "error", error: { code: "error.api.content.video.unavailable" } });
		await expect(resolveViaCobalt("https://x.com/user/status/1", "max")).rejects.toThrow(
			"cobalt error",
		);
	});
});
