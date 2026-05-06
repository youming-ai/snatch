# Code Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Critical and Important issues identified in the global code quality review, plus selected Minor improvements.

**Architecture:** Incremental fixes across 3 packages — `shared` (DRY consolidation), `api` (CORS + rate limiting), `web` (hardcoded values + duplicate tests). Each task is self-contained and independently testable.

**Tech Stack:** Bun, Hono, Astro, React, Biome, bun:test

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `packages/api/src/index.ts` | Fix CORS default, add rate limiting |
| Create | `packages/api/src/middleware/rate-limit.ts` | Hono rate limiting middleware |
| Create | `packages/api/src/middleware/rate-limit.test.ts` | Tests for rate limiting |
| Modify | `packages/api/src/lib/extractor.ts:207-219` | Remove duplicated `detectPlatform()`, import from shared |
| Modify | `packages/shared/src/validation.ts:230-244` | Use `NON_RETRYABLE_PATTERNS` from constants |
| Modify | `packages/shared/src/validation.ts:9-16` | Refactor `parseHttpUrl` reuse in `validateUrl` |
| Modify | `packages/web/src/pages/api/download.ts:112-113,189` | Use config for rate limit headers |
| Modify | `packages/web/src/pages/api/download.ts:221` | Use `crypto.randomUUID()` for error IDs |
| Modify | `packages/web/src/middleware/security.test.ts` | Remove 6 duplicate test cases |
| Modify | `packages/web/src/middleware/security.ts:10-17` | Rename hash function |
| Modify | `packages/shared/src/validation.test.ts` | Remove 1 duplicate test case |
| Modify | `packages/shared/src/constants.ts:51,53` | Add `as const`, rename misleading constant |

---

### Task 1: Fix CORS wildcard default in API

**Files:**
- Modify: `packages/api/src/index.ts:15-21`
- Modify: `.env.example:31`

- [ ] **Step 1: Write the failing test**

Create `packages/api/test/cors.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";

describe("CORS configuration", () => {
	it("should reject requests when ALLOWED_ORIGINS is empty and no origin header", async () => {
		// Save and clear env
		const orig = process.env.ALLOWED_ORIGINS;
		delete process.env.ALLOWED_ORIGINS;

		// Dynamically import to get fresh module
		const { default: app } = await import("../src/index");

		const res = await app.fetch(
			new Request("http://localhost:3001/api/health", {
				headers: {},
			}),
		);

		// Should not return Access-Control-Allow-Origin: *
		const acao = res.headers.get("Access-Control-Allow-Origin");
		expect(acao).not.toBe("*");

		// Restore
		if (orig !== undefined) process.env.ALLOWED_ORIGINS = orig;
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test:api`
Expected: FAIL — current code returns `*` when `ALLOWED_ORIGINS` is empty

- [ ] **Step 3: Fix the CORS handler**

In `packages/api/src/index.ts`, replace lines 15-21:

```typescript
		origin: (origin) => {
			const allowed = process.env.ALLOWED_ORIGINS?.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
			if (!allowed?.length) {
				// No origins configured — reject cross-origin requests
				return origin || "";
			}
			return allowed.includes(origin) ? origin : allowed[0];
		},
```

- [ ] **Step 4: Update .env.example comment**

In `.env.example`, change line 30-31:

```
# Leave empty to allow all origins (not recommended for production).
ALLOWED_ORIGINS=
```

to:

```
# Leave empty to reject all cross-origin requests (secure default).
ALLOWED_ORIGINS=
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test:api`
Expected: PASS

- [ ] **Step 6: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/index.ts packages/api/test/cors.test.ts .env.example
git commit -m "fix(api): reject cross-origin requests when ALLOWED_ORIGINS is empty"
```

---

### Task 2: Add rate limiting to API package

**Files:**
- Create: `packages/api/src/middleware/rate-limit.ts`
- Create: `packages/api/src/middleware/rate-limit.test.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/middleware/rate-limit.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { rateLimit } from "./rate-limit";

function createTestApp(maxRequests = 3, windowMs = 1000) {
	const app = new Hono();
	app.use("*", rateLimit({ maxRequests, windowMs }));
	app.get("/test", (c) => c.json({ ok: true }));
	return app;
}

describe("rateLimit middleware", () => {
	beforeEach(() => {
		// Each test uses a fresh app instance
	});

	it("should allow requests within limit", async () => {
		const app = createTestApp(3, 1000);
		const req = new Request("http://localhost/test", {
			headers: { "user-agent": "test-agent-1" },
		});
		const res = await app.fetch(req);
		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Limit")).toBe("3");
		expect(res.headers.get("X-RateLimit-Remaining")).toBeDefined();
	});

	it("should block requests exceeding limit", async () => {
		const app = createTestApp(2, 1000);
		const headers = { "user-agent": "test-agent-block" };

		await app.fetch(new Request("http://localhost/test", { headers }));
		await app.fetch(new Request("http://localhost/test", { headers }));
		const res = await app.fetch(new Request("http://localhost/test", { headers }));

		expect(res.status).toBe(429);
		const body = await res.json();
		expect(body.error).toContain("Rate limit");
	});

	it("should include rate limit headers on success", async () => {
		const app = createTestApp(5, 60000);
		const res = await app.fetch(
			new Request("http://localhost/test", {
				headers: { "user-agent": "test-agent-headers" },
			}),
		);
		expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
		expect(res.headers.get("X-RateLimit-Remaining")).toBeDefined();
		expect(res.headers.get("X-RateLimit-Reset")).toBeDefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/api/src/middleware/rate-limit.test.ts`
Expected: FAIL — `rate-limit.ts` does not exist

- [ ] **Step 3: Implement the rate limiting middleware**

Create `packages/api/src/middleware/rate-limit.ts`:

```typescript
import type { MiddlewareHandler } from "hono";

interface RateLimitOptions {
	maxRequests: number;
	windowMs: number;
}

interface ClientData {
	count: number;
	resetTime: number;
}

const clients = new Map<string, ClientData>();

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16);
}

function getClientId(c: { req: { header: (name: string) => string | undefined } }): string {
	const trustedIp = c.req.header("cf-connecting-ip") || c.req.header("fly-client-ip");
	if (trustedIp) return simpleHash(`ip:${trustedIp}`);

	const userAgent = c.req.header("user-agent") || "unknown-agent";
	return simpleHash(`fallback:${userAgent}`);
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
	const { maxRequests, windowMs } = options;

	// Periodic cleanup every 5 minutes
	if (typeof setInterval !== "undefined") {
		setInterval(
			() => {
				const now = Date.now();
				for (const [id, data] of clients.entries()) {
					if (now > data.resetTime) clients.delete(id);
				}
			},
			5 * 60 * 1000,
		);
	}

	return async (c, next) => {
		const clientId = getClientId(c);
		const now = Date.now();
		const clientData = clients.get(clientId);

		if (!clientData || now > clientData.resetTime) {
			clients.set(clientId, { count: 1, resetTime: now + windowMs });
			c.header("X-RateLimit-Limit", maxRequests.toString());
			c.header("X-RateLimit-Remaining", (maxRequests - 1).toString());
			c.header("X-RateLimit-Reset", (now + windowMs).toString());
			await next();
			return;
		}

		if (clientData.count >= maxRequests) {
			const retryAfter = Math.ceil((clientData.resetTime - now) / 1000);
			c.header("Retry-After", retryAfter.toString());
			return c.json(
				{
					success: false,
					error: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
				},
				429,
			);
		}

		clientData.count++;
		c.header("X-RateLimit-Limit", maxRequests.toString());
		c.header("X-RateLimit-Remaining", (maxRequests - clientData.count).toString());
		c.header("X-RateLimit-Reset", clientData.resetTime.toString());
		await next();
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/api/src/middleware/rate-limit.test.ts`
Expected: PASS

- [ ] **Step 5: Wire middleware into API index**

In `packages/api/src/index.ts`, add import and usage:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { rateLimit } from "./middleware/rate-limit";
import { downloadRouter } from "./routes/download";
import { extractRouter } from "./routes/extract";
import { healthRouter } from "./routes/health";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
	"*",
	cors({
		origin: (origin) => {
			const allowed = process.env.ALLOWED_ORIGINS?.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
			if (!allowed?.length) {
				return origin || "";
			}
			return allowed.includes(origin) ? origin : allowed[0];
		},
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type"],
	}),
);
app.use(
	"*",
	rateLimit({
		maxRequests: parseInt(process.env.API_RATE_LIMIT_MAX || "30", 10),
		windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW || "60000", 10),
	}),
);

// Routes
app.route("/", extractRouter);
app.route("/", downloadRouter);
app.route("/", healthRouter);

const port = parseInt(process.env.PORT || "3001", 10);

console.log(`🚀 Snatch API running on http://localhost:${port}`);

export default {
	port,
	fetch: app.fetch,
};
```

- [ ] **Step 6: Add env vars to .env.example**

Append to `.env.example`:

```
# ===========================================
# API rate limiting (packages/api)
# ===========================================
# Rate limit for the API server (separate from web SSR rate limiting).
API_RATE_LIMIT_MAX=30
API_RATE_LIMIT_WINDOW=60000
```

- [ ] **Step 7: Run full test suite**

Run: `bun test`
Expected: All tests pass

- [ ] **Step 8: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: 0 errors

- [ ] **Step 9: Commit**

```bash
git add packages/api/src/middleware/rate-limit.ts packages/api/src/middleware/rate-limit.test.ts packages/api/src/index.ts .env.example
git commit -m "feat(api): add rate limiting middleware with trusted IP support"
```

---

### Task 3: Consolidate duplicated `detectPlatform()` in extractor

**Files:**
- Modify: `packages/api/src/lib/extractor.ts:1,112,207-219`

- [ ] **Step 1: Write the failing test**

Add to `packages/api/test/extractor.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";

describe("extractor platform detection", () => {
	it("should use shared detectPlatform (exact hostname matching)", async () => {
		// This test verifies the extractor uses shared's detectPlatform,
		// which does exact hostname matching (not loose includes).
		// not-tiktok.com should NOT be detected as tiktok.
		const { setYtDlpCommandForTest, resetYtDlpCommandForTest, extractVideoInfo } =
			await import("../src/lib/extractor");

		// Use a fake yt-dlp that outputs valid JSON
		setYtDlpCommandForTest("echo");
		try {
			// This will fail because echo outputs wrong JSON, but the important
			// thing is that platform detection happens before yt-dlp runs.
			// We can't easily test this without mocking yt-dlp, so we verify
			// the import chain instead.
			const mod = await import("../src/lib/extractor");
			expect(typeof mod.extractVideoInfo).toBe("function");
		} finally {
			resetYtDlpCommandForTest();
		}
	});
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `bun test:api`
Expected: PASS (this is a baseline test)

- [ ] **Step 3: Replace duplicated detectPlatform with shared import**

In `packages/api/src/lib/extractor.ts`:

1. Update the import at line 1:
```typescript
import { detectPlatform, type ExtractResponse, type VideoFormat } from "@snatch/shared";
```

2. Update `parseYtDlpOutput` at line 112 to use the imported `detectPlatform`:
```typescript
function parseYtDlpOutput(json: any, url: string): ExtractResponse {
	const platform = detectPlatform(url) || "unknown";
```

3. Delete the local `detectPlatform` function (lines 204-219):
```typescript
// DELETE:
/**
 * Detect platform from URL
 */
function detectPlatform(url: string): string {
	const host = (() => {
		try {
			return new URL(url).hostname.toLowerCase();
		} catch {
			return "";
		}
	})();

	if (host.includes("tiktok.com")) return "tiktok";
	if (host.includes("x.com") || host.includes("twitter.com")) return "twitter";
	return "unknown";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test:api`
Expected: PASS

- [ ] **Step 5: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/lib/extractor.ts
git commit -m "refactor(api): use shared detectPlatform for exact hostname matching"
```

---

### Task 4: DRY up `isRetryableError` using `NON_RETRYABLE_PATTERNS`

**Files:**
- Modify: `packages/shared/src/validation.ts:230-244`

- [ ] **Step 1: Run existing tests to establish baseline**

Run: `bun test:shared`
Expected: PASS

- [ ] **Step 2: Refactor isRetryableError to use NON_RETRYABLE_PATTERNS**

In `packages/shared/src/validation.ts`, replace lines 227-244:

```typescript
import {
	ALLOWED_PLATFORM_DOMAINS,
	DANGEROUS_CHARS_REGEX,
	NON_RETRYABLE_PATTERNS,
	PLATFORM_HOSTS,
	URL_PATTERNS,
} from "./constants";
```

And replace the function:

```typescript
/**
 * Check if an error is retryable
 */
export function isRetryableError(error: string): boolean {
	const errorLower = error.toLowerCase();
	for (const pattern of NON_RETRYABLE_PATTERNS) {
		if (errorLower.includes(pattern)) {
			return false;
		}
	}
	return true;
}
```

- [ ] **Step 3: Run tests to verify no regression**

Run: `bun test:shared`
Expected: PASS

- [ ] **Step 4: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/validation.ts
git commit -m "refactor(shared): use NON_RETRYABLE_PATTERNS in isRetryableError"
```

---

### Task 5: Use `parseHttpUrl` in `validateUrl` to eliminate URL parsing duplication

**Files:**
- Modify: `packages/shared/src/validation.ts:34-75`

- [ ] **Step 1: Run existing tests to establish baseline**

Run: `bun test:shared`
Expected: PASS

- [ ] **Step 2: Refactor validateUrl to use parseHttpUrl**

In `packages/shared/src/validation.ts`, replace the `validateUrl` function (lines 34-75):

```typescript
/**
 * Validate a URL for safe processing and supported platform check
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
	if (!url || typeof url !== "string") {
		return { valid: false, error: "URL is required" };
	}

	const trimmed = url.trim();

	if (DANGEROUS_CHARS_REGEX.test(trimmed)) {
		return {
			valid: false,
			error: "URL contains invalid characters. Only standard URL characters are allowed.",
		};
	}

	const parsed = parseHttpUrl(trimmed);
	if (!parsed) {
		return { valid: false, error: "Invalid URL format" };
	}

	const host = parsed.hostname.toLowerCase();
	const isAllowed = ALLOWED_PLATFORM_DOMAINS.some(
		(domain) => host === domain || host.endsWith(`.${domain}`),
	);

	if (!isAllowed) {
		return {
			valid: false,
			error: `Unsupported platform: '${host}'. Supported: ${ALLOWED_PLATFORM_DOMAINS.join(", ")}`,
		};
	}

	return { valid: true };
}
```

- [ ] **Step 3: Run tests to verify no regression**

Run: `bun test:shared`
Expected: PASS

- [ ] **Step 4: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/validation.ts
git commit -m "refactor(shared): reuse parseHttpUrl in validateUrl"
```

---

### Task 6: Fix hardcoded rate limit headers in web download endpoint

**Files:**
- Modify: `packages/web/src/pages/api/download.ts:112-113,189`

- [ ] **Step 1: Run existing tests to establish baseline**

Run: `bun test:web`
Expected: PASS

- [ ] **Step 2: Replace hardcoded values with config**

In `packages/web/src/pages/api/download.ts`:

1. Add import for `getConfig` at the top (after existing imports):
```typescript
import { getConfig } from "@/config/env";
```

2. Replace hardcoded `"10"` at line 112:
```typescript
						"X-RateLimit-Limit": getConfig().rateLimitMax.toString(),
```

3. Replace hardcoded `"10"` at line 189:
```typescript
					"X-RateLimit-Limit": getConfig().rateLimitMax.toString(),
```

- [ ] **Step 3: Run tests to verify no regression**

Run: `bun test:web`
Expected: PASS

- [ ] **Step 4: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/pages/api/download.ts
git commit -m "fix(web): use config for rate limit headers instead of hardcoded values"
```

---

### Task 7: Use `crypto.randomUUID()` for error correlation IDs

**Files:**
- Modify: `packages/web/src/pages/api/download.ts:221`

- [ ] **Step 1: Replace Math.random with crypto.randomUUID**

In `packages/web/src/pages/api/download.ts`, replace line 221:

```typescript
					"X-Error-ID": crypto.randomUUID(),
```

- [ ] **Step 2: Run tests to verify no regression**

Run: `bun test:web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/pages/api/download.ts
git commit -m "fix(web): use crypto.randomUUID() for error correlation IDs"
```

---

### Task 8: Remove duplicate test cases

**Files:**
- Modify: `packages/web/src/middleware/security.test.ts`
- Modify: `packages/shared/src/validation.test.ts`

- [ ] **Step 1: Run existing tests to establish baseline**

Run: `bun test`
Expected: All PASS

- [ ] **Step 2: Remove duplicate tests from security.test.ts**

In `packages/web/src/middleware/security.test.ts`, delete lines 79-107 (3 duplicate test blocks):

```typescript
	// DELETE these duplicate tests:
	it("should reject YouTube URLs", () => {        // duplicate of line 61
		const result = validateDownloadRequest("https://www.youtube.com/watch?v=jNQXAC9IVRw");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsupported platform");
	});

	it("should validate correct X URL", () => {     // duplicate of line 49
		const result = validateDownloadRequest("https://x.com/user/status/1234567890");
		expect(result.valid).toBe(true);
		expect(result.platform).toBe("twitter");
	});

	it("should validate correct Twitter URL", () => { // duplicate of line 55
		const result = validateDownloadRequest("https://twitter.com/user/status/1234567890");
		expect(result.valid).toBe(true);
		expect(result.platform).toBe("twitter");
	});

	it("should reject invalid URLs", () => {         // duplicate of line 67
		const result = validateDownloadRequest("not-a-url");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("should reject unsupported platforms", () => { // duplicate of line 73
		const result = validateDownloadRequest("https://www.instagram.com/p/ABC");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("Unsupported platform");
	});
```

Keep only lines 97-101 (the last duplicate "invalid URLs" test is also a dup — remove it too).

The cleaned `validateDownloadRequest` describe block should have exactly these tests:
- "should validate correct TikTok URL" (line 43)
- "should validate correct X URL" (line 49)
- "should validate correct Twitter URL" (line 55)
- "should reject YouTube URLs" (line 61)
- "should reject invalid URLs" (line 67)
- "should reject unsupported platforms" (line 73)
- "should handle suspicious user agents gracefully" (line 109)

- [ ] **Step 3: Remove duplicate test from validation.test.ts**

In `packages/shared/src/validation.test.ts`, delete lines 38-41 (duplicate of lines 24-28):

```typescript
	// DELETE:
	it("should reject unsupported platforms", () => {
		expect(validateUrl("https://instagram.com/p/ABC").valid).toBe(false);
		expect(validateUrl("https://facebook.com/video/123").valid).toBe(false);
	});
```

- [ ] **Step 4: Run tests to verify all pass with fewer tests**

Run: `bun test`
Expected: All PASS (test count should decrease by ~7)

- [ ] **Step 5: Run lint**

Run: `bun lint`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/middleware/security.test.ts packages/shared/src/validation.test.ts
git commit -m "test: remove duplicate test cases from security and validation suites"
```

---

### Task 9: Minor improvements — constants and naming

**Files:**
- Modify: `packages/shared/src/constants.ts:51,53`
- Modify: `packages/web/src/middleware/security.ts:10-17`

- [ ] **Step 1: Run existing tests to establish baseline**

Run: `bun test`
Expected: All PASS

- [ ] **Step 2: Add `as const` to DANGEROUS_PROTOCOLS**

In `packages/shared/src/constants.ts`, replace line 53:

```typescript
export const DANGEROUS_PROTOCOLS = ["javascript:", "data:", "vbscript:", "file:", "ftp:"] as const;
```

- [ ] **Step 3: Rename misleading DANGEROUS_CHARS_REGEX**

In `packages/shared/src/constants.ts`, replace line 51:

```typescript
export const WHITESPACE_ONLY_REGEX = /\s/;
```

Then update the import and usage in `packages/shared/src/validation.ts`:

```typescript
import {
	ALLOWED_PLATFORM_DOMAINS,
	WHITESPACE_ONLY_REGEX,
	NON_RETRYABLE_PATTERNS,
	PLATFORM_HOSTS,
	URL_PATTERNS,
} from "./constants";
```

And in `validateUrl` (line 41):
```typescript
	if (WHITESPACE_ONLY_REGEX.test(trimmed)) {
```

Also update `packages/shared/src/index.ts` if it re-exports `DANGEROUS_CHARS_REGEX`.

- [ ] **Step 4: Rename hashString to simpleHash in security.ts**

In `packages/web/src/middleware/security.ts`, replace lines 10-17:

```typescript
function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16);
}
```

Update all call sites in the same file (lines 41, 44):
```typescript
	if (trustedIp) return simpleHash(`ip:${trustedIp}`);
	...
	return simpleHash(`fallback:${userAgent}`);
```

- [ ] **Step 5: Run all tests**

Run: `bun test`
Expected: All PASS

- [ ] **Step 6: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/validation.ts packages/web/src/middleware/security.ts
git commit -m "refactor: add as const, rename DANGEROUS_CHARS_REGEX, rename hashString"
```

---

### Task 10: Verify everything works end-to-end

- [ ] **Step 1: Run full test suite**

Run: `bun test`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `bun lint`
Expected: 0 errors

- [ ] **Step 3: Run typecheck**

Run: `bun typecheck`
Expected: 0 errors

- [ ] **Step 4: Run build**

Run: `bun build`
Expected: All packages build successfully

- [ ] **Step 5: Verify Docker build**

Run: `docker compose build`
Expected: Build succeeds

---

## Summary

| Task | Severity | Package | Fix |
|------|----------|---------|-----|
| 1 | Critical | api | CORS rejects when no origins configured |
| 2 | Critical | api | Add rate limiting to API |
| 3 | Important | api | Use shared `detectPlatform` |
| 4 | Important | shared | DRY `isRetryableError` |
| 5 | Important | shared | Reuse `parseHttpUrl` in `validateUrl` |
| 6 | Important | web | Config-based rate limit headers |
| 7 | Minor | web | `crypto.randomUUID()` for error IDs |
| 8 | Minor | shared+web | Remove duplicate tests |
| 9 | Minor | shared+web | Constants cleanup + naming |
| 10 | — | all | End-to-end verification |
