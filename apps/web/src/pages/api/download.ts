import { formatFileSize, parseQuality } from "@snatch/shared";

import type { APIRoute } from "astro";
import { checkRateLimit, getClientId, validateDownloadRequest } from "@/middleware/security";
import type { DownloadResult, SupportedPlatform } from "@/types/download";

// API service URL (configurable via environment)
const API_URL = import.meta.env.API_URL || process.env.API_URL || "http://localhost:3001";

// Request size limit: 10KB (should be more than enough for URL)
const MAX_BODY_SIZE = 10 * 1024;

interface ExtractFormat {
	quality: string;
	url: string;
	ext: string;
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
	const platform = apiResponse.platform as SupportedPlatform;

	return apiResponse.formats.map((format, index) => {
		const downloadUrl = `${API_URL}/api/download?url=${encodeURIComponent(originalUrl)}`;

		return {
			id: `${platform}-${Date.now()}-${index}`,
			type: "video" as const,
			url: originalUrl,
			thumbnail: apiResponse.thumbnail,
			downloadUrl,
			title: apiResponse.title,
			size: format.filesize ? formatFileSize(format.filesize) : "Unknown",
			platform,
			quality: parseQuality(format.quality),
			isMock: false,
		};
	});
}

export const POST: APIRoute = async ({ request }) => {
	try {
		const clientId = getClientId(request);

		// Check request size before parsing
		const contentLength = request.headers.get("content-length");
		if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
			return new Response(
				JSON.stringify({
					success: false,
					error: `Request body too large. Maximum size is ${MAX_BODY_SIZE / 1024}KB.`,
				}),
				{
					status: 413,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

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
						"X-RateLimit-Limit": "10",
						"X-RateLimit-Remaining": "0",
						"X-RateLimit-Reset": resetTime?.toString() || "",
						"Retry-After": resetInMinutes.toString(),
					},
				},
			);
		}

		// Get request data
		let requestBody: { url?: string };
		try {
			requestBody = await request.json();
		} catch (parseError) {
			if (import.meta.env.DEV) {
				console.error("Failed to parse request body:", parseError);
			}
			return new Response(
				JSON.stringify({
					success: false,
					error: "Invalid JSON in request body",
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const { url } = requestBody;

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

		const apiResponse = await fetch(`${API_URL}/api/extract`, {
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
					"X-RateLimit-Limit": "10",
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
