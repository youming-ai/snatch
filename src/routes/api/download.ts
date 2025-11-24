import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import {
	checkRateLimit,
	getClientId,
	sanitizeResponse,
	validateDownloadRequest,
} from "@/middleware/security";
import { downloadService } from "@/services/unified-download.service";

export const Route = createFileRoute("/api/download")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				try {
					const clientId = getClientId(request);

					// Rate limiting check
					const rateLimitCheck = checkRateLimit(clientId);
					if (!rateLimitCheck.allowed) {
						const resetTime = rateLimitCheck.resetTime;
						const resetInMinutes = Math.ceil(
							((resetTime || Date.now() + 60000) - Date.now()) / 60000,
						);

						return json(
							{
								success: false,
								error: `Rate limit exceeded. Please try again in ${resetInMinutes} minute${resetInMinutes > 1 ? "s" : ""}.`,
							},
							{
								status: 429,
								headers: {
									"X-RateLimit-Limit": "10",
									"X-RateLimit-Remaining": "0",
									"X-RateLimit-Reset": resetTime?.toString(),
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
						return json(
							{ success: false, error: "Invalid JSON in request body" },
							{ status: 400 },
						);
					}

					const { url } = requestBody;

					if (!url || typeof url !== "string") {
						return json(
							{
								success: false,
								error: url ? "URL must be a string" : "URL is required",
								received: typeof url,
							},
							{ status: 400 },
						);
					}

					// Security validation
					const validation = validateDownloadRequest(
						url,
						request.headers.get("user-agent") || undefined,
					);

					if (!validation.valid) {
						return json(
							{
								success: false,
								error: validation.error || "Invalid request",
							},
							{ status: 400 },
						);
					}

					// Use the unified download service
					const response = await downloadService.download(url.trim());

					if (!response.success) {
						return json(
							{
								success: false,
								error: response.error || "Failed to process download request",
								platform: response.platform,
							},
							{
								status: response.error?.includes("Unsupported") ? 400 : 500,
							},
						);
					}

					// Sanitize response data
					const sanitizedResults = sanitizeResponse(
						response.results || [],
						response.platform || "instagram",
					);

					return json(
						{
							success: true,
							results: sanitizedResults,
							platform: response.platform,
						},
						{
							headers: {
								"X-RateLimit-Limit": "10",
								"X-RateLimit-Remaining": (10 - rateLimitCheck.count).toString(),
								"X-RateLimit-Reset": rateLimitCheck.resetTime?.toString(),
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

					const _errorMessage =
						error instanceof Error
							? error.message
							: "Failed to process download request";

					return json(
						{
							success: false,
							error: "An unexpected error occurred. Please try again later.",
						},
						{
							status: 500,
							headers: {
								"X-Error-ID": Math.random().toString(36).substr(2, 9), // For debugging
							},
						},
					);
				}
			},
		},
	},
});
