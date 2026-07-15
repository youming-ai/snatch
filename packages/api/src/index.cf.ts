import app from "./app";

interface EnvWithAssets {
	ASSETS?: {
		fetch: typeof fetch;
	};
}

app.all("*", async (c) => {
	const env = c.env as EnvWithAssets | undefined;
	if (env?.ASSETS && typeof env.ASSETS.fetch === "function") {
		return await env.ASSETS.fetch(c.req.raw);
	}
	return c.text("404 Not Found", 404);
});

export default app;
