import { formatFileSize, parseQuality } from "@snatch/shared";

import type { APIRoute } from "astro";
import { getConfig } from "@/config/env";
import { checkRateLimit, getClientId, validateDownloadRequest } from "@/middleware/security";
import type { DownloadFormat, DownloadResult, SupportedPlatform } from "@/types/download";

// Internal API URL — used by the web SSR layer to reach the API service.
// In Docker this resolves to `http://api:3001` (container network);
// for local `bun dev` outside Docker it falls back to API_URL or localhost.
const API_URL_INTERNAL =
	import.meta.env.API_URL_INTERNAL ||
	process.env.API_URL_INTERNAL ||
	import.meta.env.API_URL ||
	process.env.API_URL ||
	"http://localhost:3001";

// Request size limit: 10KB (should be more than enough for URL)
const MAX_BODY_SIZE = 10 * 1024;

interface ExtractFormat {
	quality: string;
	url: string;
	ext: string;
	format_id: string;
	filesize?: number;
}

interface ExtractApiResponse {
	success: boolean;
	platform: string;
	title: string;
	thumbnail?: string;
	formats: ExtractFormat[];
	error?: string;
}

function transformResponse(apiResponse: ExtractApiResponse, originalUrl: string): DownloadResult[] {
	if (!apiResponse.formats?.length) return [];

	const platform = apiResponse.platform as SupportedPlatform;
	const formats: DownloadFormat[] = apiResponse.formats.map((f) => ({
		formatId: f.format_id,
		quality: f.quality,
		qualityCategory: parseQuality(f.quality),
		size: f.filesize ? formatFileSize(f.filesize) : undefined,
		downloadUrl: `/api/download?url=${encodeURIComponent(originalUrl)}&format_id=${encodeURIComponent(f.format_id)}`,
	}));

	return [
		{
			id: `${platform}-${Date.now()}`,
			type: "video",
			url: originalUrl,
			thumbnail: apiResponse.thumbnail,
			title: apiResponse.title,
			platform,
			formats,
			isMock: false,
		},
	];
}

async function readJsonBody(
	request: Request,
): Promise<{ ok: true; value: { url?: string } } | { ok: false; response: Response }> {
	const bodyText = await request.text();
	if (new TextEncoder().encode(bodyText).length > MAX_BODY_SIZE) {
		return {
			ok: false,
			response: new Response(
				JSON.stringify({
					success: false,
					error: `Request body too large. Maximum size is ${MAX_BODY_SIZE / 1024}KB.`,
				}),
				{ status: 413, headers: { "Content-Type": "application/json" } },
			),
		};
	}

	try {
		return { ok: true, value: JSON.parse(bodyText) };
	} catch {
		return {
			ok: false,
			response: new Response(
				JSON.stringify({ success: false, error: "Invalid JSON in request body" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			),
		};
	}
}

export const POST: APIRoute = async ({ request }) => {
	try {
		const clientId = getClientId(request);

		// Rate limiting check
		const rateLimitCheck = checkRateLimit(clientId);
		if (!rateLimitCheck.allowed) {
			const resetTime = rateLimitCheck.resetTime;
			const resetInMinutes = Math.ceil(((resetTime || Date.now() + 60000) - Date.now()) / 60000);

			return new Response(
				JSON.stringify({
					success: false,
					error: `Rate limit exceeded. Please try again in ${resetInMinutes} minute${resetInMinutes > 1 ? "s" : ""}.`,
				}),
				{
					status: 429,
					headers: {
						"Content-Type": "application/json",
						"X-RateLimit-Limit": getConfig().rateLimitMax.toString(),
						"X-RateLimit-Remaining": "0",
						"X-RateLimit-Reset": resetTime?.toString() || "",
						"Retry-After": resetInMinutes.toString(),
					},
				},
			);
		}

		const parsedBody = await readJsonBody(request);
		if (!parsedBody.ok) return parsedBody.response;
		const { url } = parsedBody.value;

		if (!url || typeof url !== "string") {
			return new Response(
				JSON.stringify({
					success: false,
					error: url ? "URL must be a string" : "URL is required",
					received: typeof url,
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		// Security validation
		const validation = validateDownloadRequest(url, request.headers.get("user-agent") || undefined);

		if (!validation.valid) {
			return new Response(
				JSON.stringify({
					success: false,
					error: validation.error || "Invalid request",
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		// Forward request to API service with timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

		const apiResponse = await fetch(`${API_URL_INTERNAL}/api/extract`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url: url.trim() }),
			signal: controller.signal,
		}).finally(() => clearTimeout(timeoutId));

		const apiData: ExtractApiResponse = await apiResponse.json();

		if (!apiData.success || !apiData.formats?.length) {
			return new Response(
				JSON.stringify({
					success: false,
					error: apiData.error || "Failed to extract download links",
					platform: apiData.platform,
				}),
				{
					status: apiResponse.ok ? 500 : apiResponse.status,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Transform to frontend format
		const results = transformResponse(apiData, url.trim());

		return new Response(
			JSON.stringify({
				success: true,
				results,
				platform: apiData.platform,
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"X-RateLimit-Limit": getConfig().rateLimitMax.toString(),
					"X-RateLimit-Reset": rateLimitCheck.resetTime?.toString() || "",
				},
			},
		);
	} catch (error) {
		// Only log detailed errors in development
		if (import.meta.env.DEV) {
			console.error("Download API error:", {
				error: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : "No stack trace",
				timestamp: new Date().toISOString(),
				clientId: getClientId(request),
			});
		}

		// Check if API service is unavailable
		const isConnectionError =
			error instanceof Error &&
			(error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed"));

		return new Response(
			JSON.stringify({
				success: false,
				error: isConnectionError
					? "Download service unavailable. Please ensure the backend is running."
					: "An unexpected error occurred. Please try again later.",
			}),
			{
				status: isConnectionError ? 503 : 500,
				headers: {
					"Content-Type": "application/json",
					"X-Error-ID": Math.random().toString(36).substring(2, 11),
				},
			},
		);
	}
};

// Streams the actual file from the internal API so the browser only ever
// talks to the web origin — keeps deployments single-domain.
export const GET: APIRoute = async ({ request }) => {
	const url = new URL(request.url);
	const target = url.searchParams.get("url");
	const formatId = url.searchParams.get("format_id");

	if (!target) {
		return new Response(JSON.stringify({ success: false, error: "URL is required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const clientId = getClientId(request);
	const rateLimitCheck = checkRateLimit(clientId);
	if (!rateLimitCheck.allowed) {
		const resetTime = rateLimitCheck.resetTime;
		const resetInMinutes = Math.ceil(((resetTime || Date.now() + 60000) - Date.now()) / 60000);
		return new Response(
			JSON.stringify({
				success: false,
				error: `Rate limit exceeded. Please try again in ${resetInMinutes} minute${resetInMinutes > 1 ? "s" : ""}.`,
			}),
			{
				status: 429,
				headers: {
					"Content-Type": "application/json",
					"Retry-After": resetInMinutes.toString(),
				},
			},
		);
	}

	const validation = validateDownloadRequest(
		target,
		request.headers.get("user-agent") || undefined,
	);
	if (!validation.valid) {
		return new Response(
			JSON.stringify({ success: false, error: validation.error || "Invalid request" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	try {
		const upstreamUrl = new URL(`${API_URL_INTERNAL}/api/download`);
		upstreamUrl.searchParams.set("url", target);
		if (formatId) upstreamUrl.searchParams.set("format_id", formatId);

		const upstream = await fetch(upstreamUrl.toString(), { signal: request.signal });

		// If upstream returned an error status and JSON, forward it directly
		const contentType = upstream.headers.get("content-type") || "";
		if (!upstream.ok && contentType.includes("application/json")) {
			return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
		}

		const headers = new Headers();
		for (const name of ["content-type", "content-disposition", "content-length"]) {
			const value = upstream.headers.get(name);
			if (value) headers.set(name, value);
		}
		return new Response(upstream.body, { status: upstream.status, headers });
	} catch (error) {
		const isConnectionError =
			error instanceof Error &&
			(error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed"));
		return new Response(
			JSON.stringify({
				success: false,
				error: isConnectionError
					? "Download service unavailable."
					: "An unexpected error occurred.",
			}),
			{
				status: isConnectionError ? 503 : 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
