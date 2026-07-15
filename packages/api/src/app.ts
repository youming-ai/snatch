import { Hono } from "hono";
import { env } from "hono/adapter";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { rateLimit } from "./middleware/rate-limit";
import { downloadRouter } from "./routes/download";
import { healthRouter } from "./routes/health";

const app = new Hono();

app.use("*", logger());

app.use(
	"/api/*",
	cors({
		origin: (origin, c) => {
			const allowedOrigins = env(c).ALLOWED_ORIGINS as string | undefined;
			const allowed = allowedOrigins
				?.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
			if (!allowed?.length) {
				return "";
			}
			return allowed.includes(origin) ? origin : allowed[0];
		},
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type"],
	}),
);

app.use("/api/*", rateLimit());

app.route("/", downloadRouter);
app.route("/", healthRouter);

export default app;
