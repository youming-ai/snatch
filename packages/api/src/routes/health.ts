import { Hono } from "hono";

const healthRouter = new Hono();

healthRouter.get("/health", (c) => c.text("OK"));

export { healthRouter };
