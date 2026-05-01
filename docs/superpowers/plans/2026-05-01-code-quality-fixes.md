# Code Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all reviewed security, validation, streaming, config, accessibility, cache, and test coverage issues without changing package boundaries.

**Architecture:** Centralize URL host validation in `packages/shared`, enforce the same validation/rate-limit path in both web proxy methods, and make API subprocess handling read process output concurrently with process exit. Keep changes small and test-first, with focused commits after each task.

**Tech Stack:** Bun workspaces, Bun test runner, Hono, Astro SSR routes, React 19, TypeScript, Biome.

---

## File Map

- Modify `packages/shared/src/constants.ts`: domain aliases and URL patterns for supported platforms.
- Modify `packages/shared/src/validation.ts`: hostname-based platform detection, converged validation, HTTP(S)-only sanitization.
- Modify `packages/shared/src/validation.test.ts`: spoofed host, TikTok short URL, protocol, and YouTube rejection coverage.
- Modify `packages/web/src/middleware/security.ts`: safer client ID behavior and shared validation use.
- Modify `packages/web/src/middleware/security.test.ts`: client ID, URL validation, and rejection coverage.
- Modify `packages/web/src/pages/api/download.ts`: bounded JSON read and GET validation/rate limiting.
- Create `packages/web/src/pages/api/download.test.ts`: Astro route tests for POST and GET guardrails.
- Modify `packages/api/src/routes/extract.ts`: malformed JSON handling.
- Create `packages/api/test/extract-route.test.ts`: malformed JSON route test.
- Modify `packages/api/src/lib/extractor.ts`: concurrent stdout/stderr reads, process exit checks, backpressure-aware stream.
- Create `packages/api/test/extractor.test.ts`: subprocess failure/lifecycle tests using a mock command hook.
- Modify `packages/api/src/lib/cache.ts`: true refresh-on-get LRU.
- Modify `packages/api/test/cache.test.ts`: LRU recency coverage.
- Modify `packages/web/src/components/DownloaderInput.tsx`: accessible input name.
- Modify `packages/web/src/components/DownloaderApp.tsx`: alert/live error semantics.
- Modify `docker-compose.yml`: pass web `PUBLIC_RATE_LIMIT_MAX` and `PUBLIC_RATE_LIMIT_WINDOW` env vars.
- Optionally modify `AGENTS.md`: only if implementation adds future-agent-relevant proxy/env guidance.

## Task 1: Shared URL Validation Contract

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/validation.ts`
- Test: `packages/shared/src/validation.test.ts`

- [ ] **Step 1: Write failing shared validation tests**

Add these tests to `packages/shared/src/validation.test.ts`:

```ts
it("should reject spoofed platform domains in path", () => {
	expect(detectPlatform("https://evil.com/x.com/user/status/1234567890")).toBeNull();
	expect(validate("https://evil.com/x.com/user/status/1234567890").isValid).toBe(false);
	expect(validateUrl("https://evil.com/x.com/user/status/1234567890").valid).toBe(false);
});

it("should accept TikTok short share URLs without content IDs", () => {
	const result = validate("https://vm.tiktok.com/ZMabc123/");
	expect(result.isValid).toBe(true);
	expect(result.platform).toBe("tiktok");
	expect(result.contentId).toBeUndefined();
});

it("should reject non-http protocols when sanitizing", () => {
	expect(() => sanitizeUrl("mailto:user@example.com")).toThrow("Unsupported protocol");
	expect(() => sanitizeUrl("blob:https://x.com/id")).toThrow("Unsupported protocol");
});
```

- [ ] **Step 2: Run shared tests and verify failure**

Run: `bun test:shared`

Expected: the new spoofed-domain, TikTok short URL, and sanitize protocol tests fail before implementation.

- [ ] **Step 3: Update platform domain constants**

In `packages/shared/src/constants.ts`, replace `URL_PATTERNS` and domain constants with this shape:

```ts
export const PLATFORM_HOSTS: Record<SupportedPlatform, string[]> = {
	[SUPPORTED_PLATFORMS.TWITTER]: ["x.com", "twitter.com"],
	[SUPPORTED_PLATFORMS.TIKTOK]: ["tiktok.com"],
};

export const PLATFORM_CONFIGS: Record<SupportedPlatform, PlatformConfig> = {
	[SUPPORTED_PLATFORMS.TWITTER]: {
		domain: "x.com",
		name: "X",
		color: "text-blue-400",
		bgColor: "bg-blue-400/10",
		description: "Videos, GIFs",
		supportedMedia: ["video"],
	},
	[SUPPORTED_PLATFORMS.TIKTOK]: {
		domain: "tiktok.com",
		name: "TikTok",
		color: "text-black dark:text-white",
		bgColor: "bg-gray-500/10",
		description: "No Watermark Videos",
		supportedMedia: ["video"],
	},
};

export const PLATFORM_DOMAINS = Object.values(PLATFORM_HOSTS).flat();

export const URL_PATTERNS = {
	twitter: {
		patterns: [/\/status\/(\d+)/i],
		requiresContentId: true,
	},
	tiktok: {
		patterns: [/\/video\/(\d+)/i, /\/@[^/]+\/video\/(\d+)/i],
		requiresContentId: false,
	},
} as const;

export const ALLOWED_PLATFORM_DOMAINS = PLATFORM_DOMAINS;
```

- [ ] **Step 4: Implement hostname-based validation**

In `packages/shared/src/validation.ts`, import `PLATFORM_HOSTS` and use these helpers:

```ts
function parseHttpUrl(url: string): URL | null {
	try {
		const parsed = new URL(url.trim());
		return ["http:", "https:"].includes(parsed.protocol) ? parsed : null;
	} catch {
		return null;
	}
}

function hostMatchesDomain(host: string, domain: string): boolean {
	return host === domain || host.endsWith(`.${domain}`);
}

function platformFromHost(host: string): SupportedPlatform | null {
	for (const [platform, domains] of Object.entries(PLATFORM_HOSTS)) {
		if (domains.some((domain) => hostMatchesDomain(host, domain))) {
			return platform as SupportedPlatform;
		}
	}
	return null;
}
```

Then update `detectPlatform()` to parse and match only hostnames:

```ts
export function detectPlatform(url: string): SupportedPlatform | null {
	const parsed = parseHttpUrl(url);
	if (!parsed) return null;
	return platformFromHost(parsed.hostname.toLowerCase());
}
```

Update `validateUrl()` to use `parseHttpUrl()` and `platformFromHost()` instead of separately scanning `ALLOWED_PLATFORM_DOMAINS`:

```ts
const parsed = parseHttpUrl(trimmed);
if (!parsed) {
	try {
		const protocol = new URL(trimmed).protocol;
		return {
			valid: false,
			error: `Unsupported protocol '${protocol}'. Only HTTP and HTTPS are allowed.`,
		};
	} catch {
		return { valid: false, error: "Invalid URL format" };
	}
}

const platform = platformFromHost(parsed.hostname.toLowerCase());
if (!platform) {
	return {
		valid: false,
		error: `Unsupported platform: '${parsed.hostname.toLowerCase()}'. Supported: ${ALLOWED_PLATFORM_DOMAINS.join(", ")}`,
	};
}
```

Update `validate()` so content ID is required only when the platform requires it:

```ts
const platformConfig = URL_PATTERNS[platform];
const contentId = extractContentId(trimmedUrl, platform);
if (platformConfig.requiresContentId && !contentId) {
	errors.push(`Could not extract content ID from ${platform} URL`);
	return { isValid: false, errors, platform };
}
```

Update `sanitizeUrl()` protocol handling:

```ts
const urlObj = new URL(trimmedUrl);
if (!["http:", "https:"].includes(urlObj.protocol)) {
	throw new Error("Unsupported protocol detected");
}
```

- [ ] **Step 5: Run shared tests and typecheck**

Run: `bun test:shared && bun typecheck`

Expected: shared tests pass and typecheck exits with code 0.

- [ ] **Step 6: Commit shared validation changes**

```bash
git add packages/shared/src/constants.ts packages/shared/src/validation.ts packages/shared/src/validation.test.ts
git commit -m "fix: harden shared URL validation"
```

## Task 2: Web Middleware Client Identity And Validation Tests

**Files:**
- Modify: `packages/web/src/middleware/security.ts`
- Test: `packages/web/src/middleware/security.test.ts`

- [ ] **Step 1: Write failing middleware tests**

Add these tests to `packages/web/src/middleware/security.test.ts`:

```ts
describe("getClientId", () => {
	it("should ignore spoofable forwarding headers without a trusted source", () => {
		const first = new Request("https://snatch.test/api/download", {
			headers: { "x-forwarded-for": "1.1.1.1" },
		});
		const second = new Request("https://snatch.test/api/download", {
			headers: { "x-forwarded-for": "2.2.2.2" },
		});

		expect(getClientId(first)).toBe(getClientId(second));
	});

	it("should use the trusted platform header when present", () => {
		const first = new Request("https://snatch.test/api/download", {
			headers: { "cf-connecting-ip": "1.1.1.1" },
		});
		const second = new Request("https://snatch.test/api/download", {
			headers: { "cf-connecting-ip": "2.2.2.2" },
		});

		expect(getClientId(first)).not.toBe(getClientId(second));
	});
});
```

- [ ] **Step 2: Run web tests and verify failure**

Run: `bun test:web`

Expected: the forwarding-header spoofing test fails before implementation.

- [ ] **Step 3: Update client identity logic**

Replace `getClientId()` in `packages/web/src/middleware/security.ts` with:

```ts
export function getClientId(request: Request): string {
	const trustedIp = request.headers.get("cf-connecting-ip") || request.headers.get("fly-client-ip");
	if (trustedIp) return hashString(`ip:${trustedIp}`);

	const userAgent = request.headers.get("user-agent") || "unknown-agent";
	return hashString(`fallback:${userAgent}`);
}
```

- [ ] **Step 4: Run web tests**

Run: `bun test:web`

Expected: middleware tests pass.

- [ ] **Step 5: Commit middleware changes**

```bash
git add packages/web/src/middleware/security.ts packages/web/src/middleware/security.test.ts
git commit -m "fix: avoid spoofable rate-limit identity"
```

## Task 3: Web API Proxy Guardrails

**Files:**
- Modify: `packages/web/src/pages/api/download.ts`
- Create: `packages/web/src/pages/api/download.test.ts`

- [ ] **Step 1: Write failing web API route tests**

Create `packages/web/src/pages/api/download.test.ts`:

```ts
import { describe, expect, it, mock } from "bun:test";
import { GET, POST } from "./download";

mock.module("@/config/env", () => ({
	getConfig: () => ({ rateLimitWindow: 60000, rateLimitMax: 1 }),
}));

function makeRequest(url: string, init?: RequestInit): Request {
	return new Request(url, {
		...init,
		headers: {
			"user-agent": `test-agent-${crypto.randomUUID()}`,
			...(init?.headers || {}),
		},
	});
}

describe("GET /api/download", () => {
	it("should reject unsupported URLs before proxying", async () => {
		const response = await GET({
			request: makeRequest("https://snatch.test/api/download?url=https%3A%2F%2Fevil.com%2Fx.com%2Fuser%2Fstatus%2F123"),
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toContain("Unsupported platform");
	});

	it("should rate limit direct download requests", async () => {
		const url = "https://snatch.test/api/download?url=https%3A%2F%2Fx.com%2Fuser%2Fstatus%2F1234567890";
		await GET({ request: makeRequest(url, { headers: { "user-agent": "limited-agent" } }) } as Parameters<typeof GET>[0]);
		const second = await GET({ request: makeRequest(url, { headers: { "user-agent": "limited-agent" } }) } as Parameters<typeof GET>[0]);

		expect(second.status).toBe(429);
	});
});

describe("POST /api/download", () => {
	it("should reject bodies over 10KB without relying on content-length", async () => {
		const response = await POST({
			request: makeRequest("https://snatch.test/api/download", {
				method: "POST",
				body: JSON.stringify({ url: "https://x.com/user/status/1234567890", pad: "x".repeat(11 * 1024) }),
				headers: { "content-type": "application/json" },
			}),
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(413);
	});
});
```

- [ ] **Step 2: Run the new route tests and verify failure**

Run: `bun test packages/web/src/pages/api/download.test.ts`

Expected: direct GET guardrail and no-content-length body limit tests fail before implementation.

- [ ] **Step 3: Add bounded JSON parsing helper**

In `packages/web/src/pages/api/download.ts`, add this helper above `POST`:

```ts
async function readJsonBody(request: Request): Promise<{ ok: true; value: { url?: string } } | { ok: false; response: Response }> {
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
```

Replace the existing content-length and `request.json()` block with:

```ts
const parsedBody = await readJsonBody(request);
if (!parsedBody.ok) return parsedBody.response;
const { url } = parsedBody.value;
```

- [ ] **Step 4: Apply validation and rate limiting to GET**

At the start of `GET`, after reading `target`, add:

```ts
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

const validation = validateDownloadRequest(target, request.headers.get("user-agent") || undefined);
if (!validation.valid) {
	return new Response(
		JSON.stringify({ success: false, error: validation.error || "Invalid request" }),
		{ status: 400, headers: { "Content-Type": "application/json" } },
	);
}
```

- [ ] **Step 5: Run web tests and typecheck**

Run: `bun test:web && bun typecheck`

Expected: web tests pass and typecheck exits with code 0.

- [ ] **Step 6: Commit web proxy guardrails**

```bash
git add packages/web/src/pages/api/download.ts packages/web/src/pages/api/download.test.ts
git commit -m "fix: guard direct download proxy requests"
```

## Task 4: API JSON Error Handling

**Files:**
- Modify: `packages/api/src/routes/extract.ts`
- Create: `packages/api/test/extract-route.test.ts`

- [ ] **Step 1: Write failing malformed JSON test**

Create `packages/api/test/extract-route.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { extractRouter } from "../src/routes/extract";

describe("extract route", () => {
	it("should return 400 for malformed JSON", async () => {
		const app = new Hono();
		app.route("/", extractRouter);

		const response = await app.request("/api/extract", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{invalid",
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body).toEqual({ success: false, error: "Invalid JSON in request body" });
	});
});
```

- [ ] **Step 2: Run API route test and verify failure**

Run: `bun test packages/api/test/extract-route.test.ts`

Expected: malformed JSON test fails before implementation.

- [ ] **Step 3: Wrap JSON parsing**

In `packages/api/src/routes/extract.ts`, replace the first body parse with:

```ts
let body: { url?: string };
try {
	body = await c.req.json<{ url?: string }>();
} catch {
	return c.json({ success: false, error: "Invalid JSON in request body" }, 400);
}

const { url } = body;
```

- [ ] **Step 4: Run API tests**

Run: `bun test:api`

Expected: API tests pass.

- [ ] **Step 5: Commit API JSON handling**

```bash
git add packages/api/src/routes/extract.ts packages/api/test/extract-route.test.ts
git commit -m "fix: return 400 for malformed extract JSON"
```

## Task 5: Extractor Process Lifecycle And Stream Backpressure

**Files:**
- Modify: `packages/api/src/lib/extractor.ts`
- Create: `packages/api/test/extractor.test.ts`

- [ ] **Step 1: Add test seams without changing behavior**

In `packages/api/src/lib/extractor.ts`, add exported command configuration used by tests:

```ts
let ytDlpCommand = "yt-dlp";

export function setYtDlpCommandForTest(command: string): void {
	ytDlpCommand = command;
}

export function resetYtDlpCommandForTest(): void {
	ytDlpCommand = "yt-dlp";
}
```

Replace both `Bun.spawn(["yt-dlp", ...])` calls with `Bun.spawn([ytDlpCommand, ...])`.

- [ ] **Step 2: Write failing extractor tests**

Create `packages/api/test/extractor.test.ts`:

```ts
import { afterEach, describe, expect, it } from "bun:test";
import {
	downloadVideoStream,
	extractVideoInfo,
	resetYtDlpCommandForTest,
	setYtDlpCommandForTest,
} from "../src/lib/extractor";

afterEach(() => {
	resetYtDlpCommandForTest();
});

describe("extractVideoInfo", () => {
	it("should report stderr from non-zero yt-dlp exits", async () => {
		setYtDlpCommandForTest("false");

		await expect(extractVideoInfo("https://x.com/user/status/1234567890")).rejects.toThrow(
			"Extraction failed",
		);
	});
});

describe("downloadVideoStream", () => {
	it("should error the stream when yt-dlp exits unsuccessfully", async () => {
		setYtDlpCommandForTest("false");
		const stream = downloadVideoStream("https://x.com/user/status/1234567890");
		const reader = stream.getReader();

		await expect(reader.read()).rejects.toThrow("Download failed");
		reader.releaseLock();
	});
});
```

- [ ] **Step 3: Run extractor tests and verify failure**

Run: `bun test packages/api/test/extractor.test.ts`

Expected: download stream failure behavior fails before lifecycle implementation.

- [ ] **Step 4: Read extraction stdout/stderr concurrently**

In `extractVideoInfo()`, start text reads before awaiting exit:

```ts
const stdoutPromise = new Response(proc.stdout).text();
const stderrPromise = new Response(proc.stderr).text();

try {
	const exitCode = await proc.exited;
	const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
	clearTimeout(timeout);

	if (exitCode !== 0) {
		const firstLine = stderr.trim().split("\n")[0] || "yt-dlp failed";
		throw new Error(`Extraction failed: ${firstLine}`);
	}

	const json = JSON.parse(stdout);
	return parseYtDlpOutput(json, url);
} finally {
	clearTimeout(timeout);
}
```

- [ ] **Step 5: Make download stream one-chunk-per-pull and check exit**

Replace the `pull()` body in `downloadVideoStream()` with:

```ts
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
const stderrPromise = new Response(proc.stderr).text();

return new ReadableStream({
	start() {
		reader = proc.stdout.getReader();
		resetTimeout();
	},
	async pull(controller) {
		if (!reader) return;
		try {
			const { done, value } = await reader.read();
			if (!done) {
				resetTimeout();
				controller.enqueue(value);
				return;
			}

			if (timeoutId) clearTimeout(timeoutId);
			const [exitCode, stderr] = await Promise.all([proc.exited, stderrPromise]);
			if (exitCode !== 0) {
				const firstLine = stderr.trim().split("\n")[0] || "yt-dlp failed";
				controller.error(new Error(`Download failed: ${firstLine}`));
				return;
			}
			controller.close();
		} catch (error) {
			if (timeoutId) clearTimeout(timeoutId);
			controller.error(error);
		}
	},
	cancel() {
		if (timeoutId) clearTimeout(timeoutId);
		reader?.releaseLock();
		proc.kill();
	},
});
```

- [ ] **Step 6: Run API tests and typecheck**

Run: `bun test:api && bun typecheck`

Expected: API tests pass and typecheck exits with code 0.

- [ ] **Step 7: Commit extractor lifecycle changes**

```bash
git add packages/api/src/lib/extractor.ts packages/api/test/extractor.test.ts
git commit -m "fix: handle yt-dlp process lifecycle"
```

## Task 6: Cache LRU Semantics

**Files:**
- Modify: `packages/api/src/lib/cache.ts`
- Test: `packages/api/test/cache.test.ts`

- [ ] **Step 1: Write failing LRU test**

Add this test to `packages/api/test/cache.test.ts`:

```ts
it("should refresh recency on get", () => {
	const cache = new Cache<string, string>(2, 1000);
	cache.put("a", "first");
	cache.put("b", "second");

	expect(cache.get("a")).toBe("first");
	cache.put("c", "third");

	expect(cache.get("a")).toBe("first");
	expect(cache.get("b")).toBeUndefined();
	expect(cache.get("c")).toBe("third");
});
```

- [ ] **Step 2: Run API tests and verify failure**

Run: `bun test:api`

Expected: refresh-on-get test fails before implementation.

- [ ] **Step 3: Implement refresh-on-get LRU**

Update `get()` in `packages/api/src/lib/cache.ts`:

```ts
get(key: K): V | undefined {
	const entry = this.data.get(key);
	if (!entry) return undefined;

	if (Date.now() >= entry.expiresAt) {
		this.data.delete(key);
		return undefined;
	}

	this.data.delete(key);
	this.data.set(key, entry);
	return entry.data;
}
```

Update `put()` to replace existing keys cleanly and evict expired entries first:

```ts
put(key: K, value: V): void {
	this.data.delete(key);
	this.cleanup();

	while (this.data.size >= this.maxSize) {
		this.evictOldest();
	}

	this.data.set(key, {
		data: value,
		expiresAt: Date.now() + this.ttlMs,
	});
}
```

Update `evictOldest()` to delete the first Map entry:

```ts
private evictOldest(): void {
	const oldestKey = this.data.keys().next().value;
	if (oldestKey !== undefined) {
		this.data.delete(oldestKey);
	}
}
```

- [ ] **Step 4: Run API tests**

Run: `bun test:api`

Expected: cache tests pass.

- [ ] **Step 5: Commit cache changes**

```bash
git add packages/api/src/lib/cache.ts packages/api/test/cache.test.ts
git commit -m "fix: implement cache LRU recency"
```

## Task 7: Accessibility Improvements

**Files:**
- Modify: `packages/web/src/components/DownloaderInput.tsx`
- Modify: `packages/web/src/components/DownloaderApp.tsx`

- [ ] **Step 1: Add accessible input name**

In `packages/web/src/components/DownloaderInput.tsx`, add an `aria-label` to the input:

```tsx
<input
	type="url"
	aria-label="Video URL"
	value={url}
	onChange={(e) => onUrlChange(e.target.value)}
	onKeyDown={handleKeyPress}
	placeholder="Paste X or TikTok URL here..."
	className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300"
	disabled={loading}
/> 
```

- [ ] **Step 2: Announce dynamic errors**

In `packages/web/src/components/DownloaderApp.tsx`, add alert semantics to the error container:

```tsx
<div className="max-w-2xl mx-auto animate-in fade-in zoom-in duration-300">
	<div
		role="alert"
		aria-live="assertive"
		className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400"
	>
		<XCircle className="w-5 h-5 shrink-0" />
		<p className="text-sm font-medium">{error}</p>
	</div>
</div>
```

- [ ] **Step 3: Run web typecheck**

Run: `bun --filter '@snatch/web' typecheck`

Expected: web typecheck exits with code 0.

- [ ] **Step 4: Commit accessibility changes**

```bash
git add packages/web/src/components/DownloaderInput.tsx packages/web/src/components/DownloaderApp.tsx
git commit -m "fix: improve downloader accessibility"
```

## Task 8: Docker Rate-Limit Configuration

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: Wire web public rate-limit env vars**

In `docker-compose.yml`, add these lines under the `web.environment` section:

```yaml
      - PUBLIC_RATE_LIMIT_MAX=${PUBLIC_RATE_LIMIT_MAX:-10}
      - PUBLIC_RATE_LIMIT_WINDOW=${PUBLIC_RATE_LIMIT_WINDOW:-60000}
```

- [ ] **Step 2: Keep `.env.example` aligned**

Confirm `.env.example` includes:

```env
PUBLIC_RATE_LIMIT_MAX=10
PUBLIC_RATE_LIMIT_WINDOW=60000
```

If those exact keys already exist, do not duplicate them.

- [ ] **Step 3: Validate compose config**

Run: `docker compose config`

Expected: command exits with code 0 and the `web` service includes both public rate-limit environment variables.

- [ ] **Step 4: Commit Docker config changes**

```bash
git add docker-compose.yml .env.example
git commit -m "fix: wire web rate-limit env in Docker"
```

## Task 9: Final Verification And Documentation Check

**Files:**
- Modify: `AGENTS.md` only if implementation creates a new repo-specific operational rule future agents would miss.

- [ ] **Step 1: Run full test suite**

Run: `bun test`

Expected: all package tests pass.

- [ ] **Step 2: Run full typecheck**

Run: `bun typecheck`

Expected: shared, API, and web typechecks exit with code 0.

- [ ] **Step 3: Run lint**

Run: `bun lint`

Expected: Biome exits with code 0. The existing schema-version informational message may appear if Biome keeps reporting it; do not treat that info-only message as a code failure.

- [ ] **Step 4: Review git diff**

Run: `git diff --stat HEAD~8..HEAD`

Expected: changes are limited to the files listed in this plan, plus `AGENTS.md` only if Step 5 changes it.

- [ ] **Step 5: Update `AGENTS.md` only for durable guidance**

If the final implementation adds a non-obvious rule, add a compact bullet. Example if trusted IP behavior remains important:

```md
- Web rate limiting ignores generic `x-forwarded-for`; deployments that need per-client IPs should provide `cf-connecting-ip` or `fly-client-ip` from a trusted proxy.
```

If no durable rule was added, leave `AGENTS.md` unchanged.

- [ ] **Step 6: Commit final documentation if changed**

If `AGENTS.md` changed:

```bash
git add AGENTS.md
git commit -m "docs: document proxy rate-limit assumptions"
```

If `AGENTS.md` did not change, skip this commit.

## Self-Review

- Spec coverage: Tasks 1-9 cover validation, web security, subprocess lifecycle, runtime config, cache LRU, accessibility, malformed JSON, and tests.
- Placeholder scan: This plan contains concrete file paths, code snippets, commands, and expected outcomes.
- Type consistency: New helpers use existing `SupportedPlatform`, `ValidationSchema`, `DownloadResult`, Hono, Astro route, and Bun test patterns.
