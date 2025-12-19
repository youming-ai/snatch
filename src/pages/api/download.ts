import type { APIRoute } from "astro";
import {
	checkRateLimit,
	getClientId,
	validateDownloadRequest,
} from "@/middleware/security";
import type { DownloadResult, SupportedPlatform } from "@/types/download";

// Rust API service URL (configurable via environment)
const RUST_API_URL = import.meta.env.RUST_API_URL || "http://localhost:3001";

interface RustFormat {
	quality: string;
	url: string;
	ext: string;
	filesize?: number;
}

interface RustExtractResponse {
	success: boolean;
	platform: string;
	title: string;
	thumbnail?: string;
	formats: RustFormat[];
	error?: string;
}

/**
 * Transform Rust API response to frontend DownloadResult format
 */
function transformRustResponse(
	rustResponse: RustExtractResponse,
	originalUrl: string,
): DownloadResult[] {
	const platform = rustResponse.platform as SupportedPlatform;

	return rustResponse.formats.map((format, index) => {
		// Use yt-dlp download endpoint with original social media URL
		// This is more reliable than using the extracted video URL directly
		const downloadUrl = `${RUST_API_URL}/api/download?url=${encodeURIComponent(originalUrl)}`;

		return {
			id: `${platform}-${Date.now()}-${index}`,
			type: "video" as const,
			url: originalUrl,
			thumbnail: rustResponse.thumbnail,
			downloadUrl,
			title: rustResponse.title,
			size: format.filesize ? formatFileSize(format.filesize) : "Unknown",
			platform,
			quality: parseQuality(format.quality),
			isMock: false,
		};
	});
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseQuality(quality: string): "hd" | "sd" | "audio" {
	const q = quality.toLowerCase();
	if (q.includes("1080") || q.includes("720") || q === "best" || q === "hd") {
		return "hd";
	}
	if (q.includes("audio")) {
		return "audio";
	}
	return "sd";
}

export const POST: APIRoute = async ({ request }) => {
	try {
		const clientId = getClientId(request);

		// Rate limiting check
		const rateLimitCheck = checkRateLimit(clientId);
		if (!rateLimitCheck.allowed) {
			const resetTime = rateLimitCheck.resetTime;
			const resetInMinutes = Math.ceil(
				((resetTime || Date.now() + 60000) - Date.now()) / 60000,
			);

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
			console.error("Failed to parse request body:", parseError);
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
		const validation = validateDownloadRequest(
			url,
			request.headers.get("user-agent") || undefined,
		);

		if (!validation.valid) {
			return new Response(
				JSON.stringify({
					success: false,
					error: validation.error || "Invalid request",
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		// Forward request to Rust API service
		const rustResponse = await fetch(`${RUST_API_URL}/api/extract`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url: url.trim() }),
		});

		const rustData: RustExtractResponse = await rustResponse.json();

		if (!rustData.success || !rustData.formats?.length) {
			return new Response(
				JSON.stringify({
					success: false,
					error: rustData.error || "Failed to extract download links",
					platform: rustData.platform,
				}),
				{
					status: rustResponse.ok ? 500 : rustResponse.status,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Transform to frontend format
		const results = transformRustResponse(rustData, url.trim());

		return new Response(
			JSON.stringify({
				success: true,
				results,
				platform: rustData.platform,
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
		console.error("Download API error:", {
			error: error instanceof Error ? error.message : "Unknown error",
			stack: error instanceof Error ? error.stack : "No stack trace",
			timestamp: new Date().toISOString(),
			clientId: getClientId(request),
		});

		// Check if Rust service is unavailable
		const isConnectionError =
			error instanceof Error &&
			(error.message.includes("ECONNREFUSED") ||
				error.message.includes("fetch failed"));

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
