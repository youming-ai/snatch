import { createRouter } from "@tanstack/react-router";
import { initSentry } from "./lib/sentry";
import { routeTree } from "./routeTree.gen";

initSentry();

// TanStack Start calls getRouter() to build a fresh router instance per request
// (and once on the client). SPA mode is enabled via the Vite plugin.
export function getRouter() {
	return createRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
