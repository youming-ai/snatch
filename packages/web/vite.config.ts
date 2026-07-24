import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// TanStack Start in SPA mode: no SSR runtime, prerenders a static shell + client
// bundle that the all-in-one API serves from ./public and Cloudflare Pages hosts.
// In dev, /api is proxied to the local API server for same-origin behavior.
export default defineConfig({
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: process.env.VITE_API_TARGET || "http://localhost:3001",
				changeOrigin: true,
			},
		},
	},
	plugins: [
		tanstackStart({ spa: { enabled: true, prerender: { outputPath: "/index" } } }),
		// react's plugin must come after start's plugin
		react(),
		tailwindcss(),
	],
});
