import pino from "pino";

export const logger = pino({
	level: process.env.LOG_LEVEL ?? "info",
	// hono-pino binds full request headers; keep credentials/session data out of logs.
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
