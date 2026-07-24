import * as Sentry from "@sentry/bun";

/**
 * Initialize Sentry once at process start. No-op unless `SENTRY_DSN` is set,
 * so local dev and tests stay quiet. Runtime is Bun (Docker/Dokploy), so we use
 * `@sentry/bun` rather than the skill's `@sentry/cloudflare` Workers wrapper.
 */
export function initSentry(): void {
	const dsn = process.env.SENTRY_DSN;
	if (!dsn) return;
	Sentry.init({
		dsn,
		environment: process.env.NODE_ENV ?? "production",
		tracesSampleRate: 0,
	});
}

export { Sentry };
