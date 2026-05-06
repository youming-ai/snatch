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
				// No origins configured — reject all cross-origin requests
				return "";
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

// Start server
const port = parseInt(process.env.PORT || "3001", 10);

console.log(`🚀 Snatch API running on http://localhost:${port}`);

export default {
	port,
	fetch: app.fetch,
};
