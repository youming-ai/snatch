import * as Sentry from "@sentry/bun";
import { Hono } from "hono";
import { env } from "hono/adapter";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { type PinoLogger, pinoLogger } from "hono-pino";
import pino from "pino";

export const logger = pino({
	level: process.env.LOG_LEVEL ?? "info",
	redact: {
		paths: [
			"req.headers.authorization",
			"req.headers.cookie",
			"req.headers['set-cookie']",
			"res.headers['set-cookie']",
		],
		censor: "[redacted]",
	},
});

import { apiKeyAuth } from "./middleware/auth";
import { rateLimit } from "./middleware/rate-limit";
import { downloadRouter } from "./routes/download";
import { healthRouter } from "./routes/health";

const app = new Hono<{ Variables: { logger: PinoLogger } }>();

// Baseline hardening on every response, static SPA included.
//
// The absence of a CSP is a decision, not an oversight. The prerendered shell
// carries three inline `<script>` blocks — JSON-LD plus two executable ones that
// TanStack Start emits (the `$_TSR` hydration bootstrap and scroll restoration) —
// and `serveStatic` hands over a finished file, so there is nowhere to inject a
// per-response nonce. `script-src 'self'` would blank the page, and
// `'unsafe-inline'` gives back most of what a policy would buy. Making it real
// means serving the shell through Hono to rewrite those tags with a nonce, which
// is a change of its own.
app.use(
	"*",
	secureHeaders({
		// Nothing legitimate frames the downloader.
		xFrameOptions: "DENY",
		// Without `includeSubDomains`: this is a self-hosted app, and pinning a
		// whole parent domain to HTTPS for 180 days is the operator's call, not
		// a side effect of deploying this container.
		strictTransportSecurity: "max-age=15552000",
		// Cross-origin API access is a supported deployment (`ALLOWED_ORIGINS`),
		// so responses are not pinned to this origin.
		crossOriginResourcePolicy: false,
	}),
);

app.use(
	"*",
	pinoLogger({
		pino: logger,
		http: {
			onReqBindings: (c) => ({ req: { method: c.req.method, url: c.req.path } }),
			onResBindings: (c) => ({ res: { status: c.res.status } }),
			onResLevel: (c) => {
				if (c.res.status >= 500) return "error";
				if (c.res.status >= 400) return "warn";
				return "info";
			},
		},
	}),
);

app.use(
	"/api/*",
	cors({
		// Only ever echo an origin that is on the allowlist. Handing back any
		// other value — an empty allowlist's first entry, say — would answer a
		// disallowed caller, or a request carrying no Origin at all, with a
		// header naming a site that *is* trusted. Hono omits the header entirely
		// when this resolves falsy, so `undefined` is the rejecting answer.
		origin: (origin, c) => {
			const allowedOrigins = env(c).ALLOWED_ORIGINS as string | undefined;
			const allowed = allowedOrigins
				?.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
			if (!allowed?.length) return undefined;
			return allowed.includes(origin) ? origin : undefined;
		},
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Authorization", "Content-Type"],
	}),
);

app.use("/api/*", rateLimit());
// Mounted after rateLimit so unauthenticated probes still consume the
// per-client abuse budget before being rejected.
app.use("/api/*", apiKeyAuth());

app.route("/", downloadRouter);
app.route("/", healthRouter);

app.onError((err, c) => {
	Sentry.captureException(err);
	c.var.logger?.error({ err }, "unhandled");
	return c.json({ success: false, error: "Internal server error" }, 500);
});

export default app;
