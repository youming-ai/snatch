/**
 * Environment detection utilities
 */

export interface EnvironmentInfo {
	isBrowser: boolean;
	isServer: boolean;
	isDevelopment: boolean;
	isProduction: boolean;
	supportsServerSideScraping: boolean;
}

/**
 * Detect current environment
 */
export function detectEnvironment(): EnvironmentInfo {
	// Check if we're in a browser environment
	const isBrowser =
		typeof window !== "undefined" && typeof document !== "undefined";
	const isServer = !isBrowser;

	// Check development vs production
	const isDevelopment =
		process?.env?.NODE_ENV === "development" ||
		(typeof globalThis !== "undefined" && (globalThis as { __DEV__?: boolean }).__DEV__ === true);
	const isProduction = !isDevelopment;

	// Check if server-side scraping is supported
	const supportsServerSideScraping =
		isServer &&
		typeof process !== "undefined" &&
		process.env.ENABLE_SCRAPING !== "false";

	return {
		isBrowser,
		isServer,
		isDevelopment,
		isProduction,
		supportsServerSideScraping,
	};
}

/**
 * Get appropriate download service based on environment
 */
export function getDownloadService() {
	const env = detectEnvironment();

	if (env.supportsServerSideScraping) {
		// Server environment with full Node.js support
		return import("../services/unified-download.service").then(
			(m) => m.downloadService,
		);
	} else {
		// Browser or limited server environment
		return import("../services/client-download.service").then(
			(m) => m.clientDownloadService,
		);
	}
}
