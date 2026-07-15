import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Pure React SPA. In dev, /api is proxied to the local API server so the app
// talks to the same origin it will in production (where the API serves this
// build's static files). No SSR, no framework runtime.
export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: process.env.VITE_API_TARGET || "http://localhost:3001",
				changeOrigin: true,
			},
		},
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
});
