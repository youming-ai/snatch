import * as Sentry from "@sentry/react";

/**
 * Browser-side Sentry. No-op unless `VITE_SENTRY_DSN` is baked into the build,
 * so local dev and unconfigured deploys stay quiet.
 */
export function initSentry(): void {
	const dsn = import.meta.env.VITE_SENTRY_DSN;
	if (!dsn || typeof document === "undefined") return;
	Sentry.init({ dsn, tracesSampleRate: 0 });
}

export { Sentry };
