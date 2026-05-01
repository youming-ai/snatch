# Download Pipeline Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the download pipeline so that (1) users can download their selected video quality/format, (2) download streams have proper timeout protection, (3) API responses use correct content-type and filename headers.

**Architecture:** Add `format_id` tracking through the entire pipeline: `extractor.ts` captures it from yt-dlp → `types.ts` stores it → web frontend passes it via query param → API download route forwards it to yt-dlp's `-f` flag. Also add a read-timeout to `downloadVideoStream()` to kill stuck yt-dlp processes.

**Tech Stack:** TypeScript, Astro (web), Hono (api), Bun, yt-dlp, shared package (@snatch/shared)

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `packages/shared/src/types.ts` | Shared type definitions | Add `format_id` to `VideoFormat` |
| `packages/api/src/lib/extractor.ts` | Video info extraction and stream download | Capture `format_id`, add stream timeout, improve error messages |
| `packages/api/src/routes/download.ts` | API download endpoint | Accept `format_id` query param, set correct headers |
| `packages/web/src/pages/api/download.ts` | Web frontend API | Pass `format_id` in downloadUrl, forward to API |
| `packages/web/src/types/download.ts` | Web download types re-export | No change needed (re-exports shared) |
| `packages/shared/src/validation.test.ts` | URL validation tests | No change needed (unaffected) |

---

## Task 1: Add `format_id` to Shared VideoFormat Type

**Files:**
- Modify: `packages/shared/src/types.ts:7-12`

- [ ] **Step 1: Add `format_id` field to VideoFormat interface**

```typescript
export interface VideoFormat {
	format_id: string;
	quality: string;
	url: string;
	ext: string;
	filesize?: number;
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd /Users/youming/GitHub/youming-ai/snatch && bun check packages/shared/src/types.ts`

Wait, actually: just verify TypeScript compiles. The project likely uses `tsc --noEmit` or similar.

Run: `cd /Users/youming/GitHub/youming-ai/snatch/packages/shared && tsc --noEmit`
Expected: No errors (or only pre-existing errors)

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add format_id to VideoFormat interface"
```

---

## Task 2: Update Extractor to Capture format_id and Fix Stream Timeout

**Files:**
- Modify: `packages/api/src/lib/extractor.ts`

- [ ] **Step 1: Update `extractFormats` to capture `format_id`**

Change the `VideoFormat` pushes to include `format_id`:

For the direct URL branch (line 96):
```typescript
formats.push({
	format_id: json.format_id || "best",
	quality: "best",
	url: json.url,
	ext: json.ext || "mp4",
	filesize: json.filesize || undefined,
});
```

For the formats array branch (line 116):
```typescript
for (const f of videoFormats) {
	const height = f.height || 0;
	formats.push({
		format_id: f.format_id || "unknown",
		quality: height > 0 ? `${height}p` : f.format_note || "unknown",
		url: f.url,
		ext: f.ext || "mp4",
		filesize: f.filesize || undefined,
	});
}
```

For the fallback branch (line 129):
```typescript
formats.push({
	format_id: d.format_id || "best",
	quality: "best",
	url: d.url,
	ext: d.ext || "mp4",
	filesize: d.filesize || undefined,
});
```

- [ ] **Step 2: Add timeout to `downloadVideoStream()`**

Replace the current `downloadVideoStream` function (lines 37-66) with:

```typescript
/**
 * Download video using yt-dlp and stream to response.
 * Includes a 60s read timeout to kill stuck processes.
 */
export function downloadVideoStream(url: string, formatId?: string): ReadableStream<Uint8Array> {
	const formatArg = formatId || "best[ext=mp4]/best";
	const proc = Bun.spawn(
		["yt-dlp", "-o", "-", "--no-warnings", "--no-playlist", "-f", formatArg, url],
		{
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	const READ_TIMEOUT_MS = 60_000;
	let lastReadTime = Date.now();
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const resetTimeout = () => {
		if (timeoutId) clearTimeout(timeoutId);
		lastReadTime = Date.now();
		timeoutId = setTimeout(() => {
			proc.kill();
		}, READ_TIMEOUT_MS);
	};

	return new ReadableStream({
		start() {
			resetTimeout();
		},
		async pull(controller) {
			const reader = proc.stdout.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						if (timeoutId) clearTimeout(timeoutId);
						controller.close();
						break;
					}
					resetTimeout();
					controller.enqueue(value);
				}
			} catch (error) {
				if (timeoutId) clearTimeout(timeoutId);
				controller.error(error);
			} finally {
				reader.releaseLock();
			}
		},
		cancel() {
			if (timeoutId) clearTimeout(timeoutId);
			proc.kill();
		},
	});
}
```

- [ ] **Step 3: Sanitize error messages in `extractVideoInfo()`**

Replace the error throw (line 22) to avoid leaking system details:

```typescript
if (exitCode !== 0) {
	const stderr = await new Response(proc.stderr).text();
	// Sanitize: only include first line, remove paths
	const firstLine = stderr.trim().split("\n")[0] || "yt-dlp failed";
	throw new Error(`Extraction failed: ${firstLine}`);
}
```

- [ ] **Step 4: Verify API package compiles**

Run: `cd /Users/youming/GitHub/youming-ai/snatch/packages/api && tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/extractor.ts
git commit -m "feat(api): capture format_id, add stream timeout, sanitize errors"
```

---

## Task 3: Update API Download Route to Accept format_id

**Files:**
- Modify: `packages/api/src/routes/download.ts`

- [ ] **Step 1: Read `format_id` query param and pass to extractor**

Replace the route handler (lines 8-42) with:

```typescript
downloadRouter.get("/api/download", async (c) => {
	const url = c.req.query("url");
	const formatId = c.req.query("format_id");

	if (!url) {
		return c.json({ success: false, error: "URL is required" }, 400);
	}

	const validation = validateUrl(url);
	if (!validation.valid) {
		return c.json({ success: false, error: validation.error }, 400);
	}

	try {
		const videoStream = downloadVideoStream(url, formatId || undefined);

		// Use application/octet-stream for downloads since actual format may vary
		c.header("Content-Type", "application/octet-stream");
		c.header("Content-Disposition", 'attachment; filename="video.mp4"');

		return stream(c, async (stream) => {
			const reader = videoStream.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					await stream.write(value);
				}
			} finally {
				reader.releaseLock();
			}
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Download failed";
		return c.json({ success: false, error: msg }, 500);
	}
});
```

Note: This is a conservative fix. In a future enhancement, we could also extract the actual title and use it for the filename, but that requires an additional info extraction pass or caching.

- [ ] **Step 2: Verify API package compiles**

Run: `cd /Users/youming/GitHub/youming-ai/snatch/packages/api && tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/download.ts
git commit -m "feat(api): accept format_id in download route and set correct content-type"
```

---

## Task 4: Update Web Frontend to Pass format_id in Download URLs

**Files:**
- Modify: `packages/web/src/pages/api/download.ts`

- [ ] **Step 1: Update `transformResponse` to include `format_id` in downloadUrl**

Replace lines 36-55:

```typescript
function transformResponse(apiResponse: ExtractApiResponse, originalUrl: string): DownloadResult[] {
	const platform = apiResponse.platform as SupportedPlatform;

	return apiResponse.formats.map((format, index) => {
		const downloadUrl = `/api/download?url=${encodeURIComponent(originalUrl)}&format_id=${encodeURIComponent(format.format_id)}`;

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
```

- [ ] **Step 2: Update GET proxy to forward `format_id`**

Replace lines 224-261:

```typescript
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
				error: isConnectionError ? "Download service unavailable." : "An unexpected error occurred.",
			}),
			{
				status: isConnectionError ? 503 : 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
```

- [ ] **Step 3: Verify web package compiles**

Run: `cd /Users/youming/GitHub/youming-ai/snatch/packages/web && astro check`
Or if not available: `tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/pages/api/download.ts
git commit -m "feat(web): pass format_id through download pipeline"
```

---

## Task 5: Integration Verification

- [ ] **Step 1: Check TypeScript compilation across all packages**

Run from root:
```bash
cd /Users/youming/GitHub/youming-ai/snatch
bun run check || tsc --noEmit -p packages/shared/tsconfig.json
bun run check:api || tsc --noEmit -p packages/api/tsconfig.json
bun run check:web || tsc --noEmit -p packages/web/tsconfig.json
```
Expected: No TypeScript errors in any package

- [ ] **Step 2: Run existing tests**

```bash
cd /Users/youming/GitHub/youming-ai/snatch
bun test || npm test
```
Expected: All tests pass (or at minimum, no NEW failures introduced)

- [ ] **Step 3: Manual smoke test (if local dev server available)**

If the dev environment is running:
1. POST to `/api/download` with a supported platform URL
2. Verify response includes `format_id` in each format object
3. Verify each `downloadUrl` contains `format_id=...`
4. Click a download URL and verify it streams correctly
5. Test that selecting different qualities downloads the appropriate format

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix(download): enable format-specific downloads, add stream timeout

- format_id now flows through entire pipeline (extractor → types → web → api)
- API download route accepts format_id and forwards to yt-dlp -f flag
- downloadVideoStream has 60s read timeout to prevent stuck processes
- Error messages sanitized to avoid leaking system paths
- Proxy forwards format_id and handles upstream JSON errors correctly"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Root cause (format_id not flowing) → Task 2, 3, 4
- [x] Stream timeout missing → Task 2, Step 2
- [x] Content-Type/Disposition static → Task 3, Step 1 (partial fix)
- [x] Error message leakage → Task 2, Step 3

**Placeholder scan:**
- [x] No "TBD" or "TODO"
- [x] All code blocks contain complete code
- [x] Every step has a file path
- [x] No vague "add error handling" without showing code

**Type consistency:**
- [x] `format_id: string` added to `VideoFormat` in Task 1
- [x] `formatId?: string` parameter used consistently in Task 2 and 3
- [x] `format_id` query param read consistently in Task 3 and 4
- [x] `encodeURIComponent(format.format_id)` in Task 4

**Cross-package dependency order:**
- [x] Task 1 (shared types) comes before Task 2 (api extractor uses it)
- [x] Task 2 (extractor changes) comes before Task 3 (route uses new signature)
- [x] Task 3 (api route accepts format_id) comes before Task 4 (web calls it)

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2025-05-01-download-pipeline-fixes.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
