import type { ExtractResponse } from "@snatch/shared";
import { validateUrl } from "@snatch/shared";
import { Hono } from "hono";
import { Cache } from "../lib/cache";
import { extractVideoInfo } from "../lib/extractor";
import { retryWithBackoff } from "../lib/retry";

const extractRouter = new Hono();

// Cache: 100 entries, 5 min TTL
const cache = new Cache<string, ExtractResponse>(100, 300_000);

extractRouter.post("/api/extract", async (c) => {
	let body: { url?: string };
	try {
		body = await c.req.json<{ url?: string }>();
	} catch {
		return c.json({ success: false, error: "Invalid JSON in request body" }, 400);
	}
	const { url } = body;

	if (!url || typeof url !== "string") {
		return c.json(
			{ success: false, error: !url ? "URL is required" : "URL must be a string" },
			400,
		);
	}

	const validation = validateUrl(url.trim());
	if (!validation.valid) {
		return c.json({ success: false, error: validation.error }, 400);
	}

	// Check cache
	const cached = cache.get(url.trim());
	if (cached) {
		return c.json(cached);
	}

	// Extract with retry
	try {
		const response = await retryWithBackoff(() => extractVideoInfo(url.trim()), 3);

		cache.put(url.trim(), response);
		return c.json(response);
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Failed to extract video info";
		return c.json({ success: false, error: msg }, 500);
	}
});

export { extractRouter };
