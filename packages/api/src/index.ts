import * as Sentry from "@sentry/bun";
import { serveStatic } from "hono/bun";
import app, { logger } from "./app";
import { startTmpCleanup } from "./lib/tmp-cleanup";
import { hasFfmpeg, usableCookiesFile } from "./lib/ytdlp";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
	Sentry.init({
		dsn,
		environment: process.env.NODE_ENV ?? "production",
		tracesSampleRate: 0,
	});
}

// Serve the static client (packages/web/dist/client, copied to ./public in the
// Docker image). Falls through to 404 when the dir is absent — e.g. local API
// dev, where the Vite dev server serves the UI and proxies /api here.
const staticRoot = process.env.STATIC_ROOT || "./public";
app.use("*", serveStatic({ root: staticRoot }));

// Backstop for media and probe metadata whose request never reached its own
// cleanup (see lib/tmp-cleanup.ts). Started here rather than in app.ts so tests
// that import the app never spawn a timer.
startTmpCleanup({
	onSweep: (removed) => logger.info({ removed }, "reclaimed stale temp files"),
});

const port = parseInt(process.env.PORT || "3001", 10);

logger.info({ port }, "Snatch running");

// Almost every site serves video and audio as separate streams, so a missing
// ffmpeg turns into a failed merge on nearly every download. Say so at boot
// rather than letting it surface as a 404 the browser cannot explain.
void hasFfmpeg().then((available) => {
	if (!available) {
		logger.warn(
			"ffmpeg is not on PATH: video/audio merging and mp3 extraction will fail for most sites",
		);
	}
});

// An empty key means a fresh random secret per process, so every link already
// handed out stops verifying the moment the container restarts — worth one line
// at boot, because the failure looks like a client bug otherwise.
if (!process.env.PROXY_SIGNING_KEY) {
	logger.warn("PROXY_SIGNING_KEY is empty: signed download links will not survive a restart");
}

// A cookie jar is the documented way past a datacenter-IP block, so a configured
// path that is missing — or is a directory, which is what a Docker bind mount of
// a missing file creates — silently costs every site that needs one.
const configuredCookies = process.env.YTDLP_COOKIES_FILE?.trim();
if (configuredCookies && !usableCookiesFile()) {
	logger.warn(
		{ cookiesFile: configuredCookies },
		"YTDLP_COOKIES_FILE is missing or not a file; continuing without cookies (login-gated sites will fail)",
	);
}

export default {
	port,
	fetch: app.fetch,
};
