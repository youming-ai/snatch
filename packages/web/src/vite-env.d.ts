/// <reference types="vite/client" />

interface ImportMetaEnv {
	/**
	 * Absolute base URL of the API origin (e.g. `https://api.snatch.example`).
	 * Empty in the all-in-one Docker build and in dev, where the SPA talks to
	 * the API same-origin (dev uses Vite's `/api` proxy).
	 */
	readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
