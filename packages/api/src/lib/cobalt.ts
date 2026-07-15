import type { CobaltOptions, CobaltResponse } from "@snatch/shared";

const DEFAULT_COBALT_API_URL = "http://localhost:9000";

let cobaltApiUrl = process.env.COBALT_API_URL || DEFAULT_COBALT_API_URL;

export function setCobaltApiUrlForTest(url: string): void {
	cobaltApiUrl = url;
}

export function resetCobaltApiUrlForTest(): void {
	cobaltApiUrl = process.env.COBALT_API_URL || DEFAULT_COBALT_API_URL;
}

/**
 * Fetch dynamic configuration and capabilities from the cobalt instance.
 */
export async function getCobaltInfo(apiBaseUrl?: string): Promise<unknown> {
	const base = (apiBaseUrl || cobaltApiUrl).replace(/\/+$/, "");
	try {
		const res = await fetch(`${base}/`, {
			method: "GET",
			headers: {
				Accept: "application/json",
			},
			signal: AbortSignal.timeout(10_000),
		});
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
		return await res.json();
	} catch (error) {
		const msg = error instanceof Error ? error.message : "request failed";
		throw new Error(`failed to query cobalt instance: ${msg}`);
	}
}

/**
 * Resolve a downloadable media response for `url` via a self-hosted cobalt instance.
 * Accepts all cobalt options and headers (e.g. Turnstile tokens or API keys).
 */
export async function resolveViaCobalt(
	url: string,
	options: CobaltOptions,
	headers?: Record<string, string>,
	apiBaseUrl?: string,
): Promise<CobaltResponse> {
	const base = (apiBaseUrl || cobaltApiUrl).replace(/\/+$/, "");

	let res: Response;
	try {
		res = await fetch(`${base}/`, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				...headers,
			},
			body: JSON.stringify({
				url,
				...options,
			}),
			signal: AbortSignal.timeout(30_000),
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : "request failed";
		throw new Error(`cobalt request failed: ${msg}`);
	}

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		try {
			const errJson = JSON.parse(text);
			if (errJson.status === "error" && errJson.error) {
				return errJson;
			}
		} catch {}
		throw new Error(`cobalt upstream error: HTTP ${res.status} ${text}`);
	}

	return (await res.json()) as CobaltResponse;
}
