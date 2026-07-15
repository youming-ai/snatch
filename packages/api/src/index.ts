import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { rateLimit } from "./middleware/rate-limit";
import { downloadRouter } from "./routes/download";
import { healthRouter } from "./routes/health";

const app = new Hono();

app.use("*", logger());

// CORS + rate limiting apply only to the API surface, never to static assets.
app.use(
	"/api/*",
	cors({
		origin: (origin) => {
			const allowed = process.env.ALLOWED_ORIGINS?.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
			if (!allowed?.length) {
				// No origins configured — reject all cross-origin requests.
				return "";
			}
			return allowed.includes(origin) ? origin : allowed[0];
		},
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type"],
	}),
);
app.use(
	"/api/*",
	rateLimit({
		maxRequests: parseInt(process.env.API_RATE_LIMIT_MAX || "30", 10),
		windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW || "60000", 10),
	}),
);

// API routes.
app.route("/", downloadRouter);
app.route("/", healthRouter);

// Serve the built SPA (packages/web/dist, copied to ./public in the Docker
// image). Falls through to 404 when the dir is absent — e.g. local API dev,
// where the Vite dev server serves the UI and proxies /api here.
const staticRoot = process.env.STATIC_ROOT || "./public";
app.use("*", serveStatic({ root: staticRoot }));

const port = parseInt(process.env.PORT || "3001", 10);

console.log(`🚀 Snatch running on http://localhost:${port}`);

export default {
	port,
	fetch: app.fetch,
};
