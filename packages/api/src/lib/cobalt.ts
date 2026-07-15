export interface CobaltResolved {
	url: string;
	filename: string;
}

const DEFAULT_COBALT_API_URL = "http://localhost:9000";

let cobaltApiUrl = process.env.COBALT_API_URL || DEFAULT_COBALT_API_URL;

export function setCobaltApiUrlForTest(url: string): void {
	cobaltApiUrl = url;
}

export function resetCobaltApiUrlForTest(): void {
	cobaltApiUrl = process.env.COBALT_API_URL || DEFAULT_COBALT_API_URL;
}

interface CobaltResponse {
	status: "tunnel" | "redirect" | "picker" | "local-processing" | "error";
	url?: string;
	filename?: string;
	picker?: { type: string; url: string }[];
	error?: { code?: string };
}

/**
 * Resolve a downloadable file URL for `url` via a self-hosted cobalt instance.
 *
 * cobalt handles format selection and muxing/remuxing server-side; it returns
 * either a `tunnel` (cobalt proxies the file) or `redirect` (direct CDN link)
 * URL. The caller proxies that URL so the browser only ever talks to our
 * origin — cobalt itself stays internal-only.
 */
export async function resolveViaCobalt(url: string, videoQuality: string): Promise<CobaltResolved> {
	const base = cobaltApiUrl.replace(/\/+$/, "");

	let res: Response;
	try {
		res = await fetch(`${base}/`, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				url,
				videoQuality,
				downloadMode: "auto",
				filenameStyle: "basic",
			}),
			signal: AbortSignal.timeout(30_000),
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : "request failed";
		throw new Error(`cobalt request failed: ${msg}`);
	}

	const data = (await res.json()) as CobaltResponse;

	switch (data.status) {
		case "tunnel":
		case "redirect":
			if (!data.url) throw new Error("cobalt returned no url");
			return { url: data.url, filename: data.filename || "video.mp4" };
		case "picker": {
			const item = data.picker?.find((p) => p.type === "video") ?? data.picker?.[0];
			if (!item?.url) throw new Error("cobalt picker contained no downloadable media");
			return { url: item.url, filename: data.filename || "video.mp4" };
		}
		case "error":
			throw new Error(`cobalt error: ${data.error?.code || "unknown"}`);
		default:
			throw new Error(`cobalt returned unexpected status: ${data.status}`);
	}
}
