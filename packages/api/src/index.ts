import { serveStatic } from "hono/bun";
import app from "./app";
import { localProcessRouter } from "./routes/local-process";

// Register Bun-only local processing route
app.route("/", localProcessRouter);
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
