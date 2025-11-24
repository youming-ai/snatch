/**
 * Environment configuration management
 * Centralizes all environment variables with type safety and validation
 */

// Configuration schema definition
interface EnvConfig {
	// Application
	appName: string;
	appDescription: string;
	appUrl: string;

	// API
	apiBaseUrl: string;
	apiTimeout: number;

	// Security
	rateLimitMax: number;
	rateLimitWindow: number;

	// Download
	defaultDownloadQuality: "hd" | "sd";
	maxFileSize: string;
	supportedFormats: string[];

	// Feature flags
	enableAnalytics: boolean;
	enableDebugMode: boolean;
	enablePerformanceMonitoring: boolean;

	// Third-party services
	sentryDsn?: string;
	googleAnalyticsId?: string;

	// Development
	mockDownloads: boolean;
	enableCorsProxy: boolean;
}

/**
 * Parse and validate environment variables
 */
function parseEnv(): EnvConfig {
	const getRequired = (key: string): string => {
		const value = import.meta.env[key];
		if (!value) {
			throw new Error(`Required environment variable ${key} is missing`);
		}
		return value;
	};

	const getOptional = (key: string, defaultValue: string = ""): string => {
		return import.meta.env[key] || defaultValue;
	};

	const getBoolean = (key: string, defaultValue: boolean = false): boolean => {
		const value = import.meta.env[key];
		if (value === undefined) return defaultValue;
		return value === "true" || value === "1";
	};

	const getNumber = (key: string, defaultValue: number): number => {
		const value = import.meta.env[key];
		if (value === undefined) return defaultValue;
		const parsed = parseInt(value, 10);
		if (isNaN(parsed)) {
			console.warn(
				`Invalid number for ${key}: ${value}, using default: ${defaultValue}`,
			);
			return defaultValue;
		}
		return parsed;
	};

	const getArray = (key: string, defaultValue: string[] = []): string[] => {
		const value = import.meta.env[key];
		if (!value) return defaultValue;
		return value
			.split(",")
			.map((item: string) => item.trim())
			.filter(Boolean);
	};

	const getQuality = (key: string): "hd" | "sd" => {
		const value = import.meta.env[key] || "hd";
		if (value === "hd" || value === "sd") return value;
		console.warn(`Invalid quality for ${key}: ${value}, using default: hd`);
		return "hd";
	};

	return {
		// Application
		appName: getRequired("VITE_APP_NAME"),
		appDescription: getRequired("VITE_APP_DESCRIPTION"),
		appUrl: getRequired("VITE_APP_URL"),

		// API
		apiBaseUrl: getRequired("VITE_API_BASE_URL"),
		apiTimeout: getNumber("VITE_API_TIMEOUT", 30000),

		// Security
		rateLimitMax: getNumber("VITE_RATE_LIMIT_MAX", 10),
		rateLimitWindow: getNumber("VITE_RATE_LIMIT_WINDOW", 60000),

		// Download
		defaultDownloadQuality: getQuality("VITE_DEFAULT_DOWNLOAD_QUALITY"),
		maxFileSize: getOptional("VITE_MAX_FILE_SIZE", "100MB"),
		supportedFormats: getArray("VITE_SUPPORTED_FORMATS", [
			"mp4",
			"jpg",
			"jpeg",
			"png",
		]),

		// Feature flags
		enableAnalytics: getBoolean("VITE_ENABLE_ANALYTICS", false),
		enableDebugMode: getBoolean("VITE_ENABLE_DEBUG_MODE", true),
		enablePerformanceMonitoring: getBoolean(
			"VITE_ENABLE_PERFORMANCE_MONITORING",
			true,
		),

		// Third-party services
		sentryDsn: getOptional("VITE_SENTRY_DSN") || undefined,
		googleAnalyticsId: getOptional("VITE_GOOGLE_ANALYTICS_ID") || undefined,

		// Development
		mockDownloads: getBoolean("VITE_MOCK_DOWNLOADS", true),
		enableCorsProxy: getBoolean("VITE_ENABLE_CORS_PROXY", true),
	};
}

/**
 * Singleton configuration instance
 */
let configInstance: EnvConfig | null = null;

/**
 * Get application configuration
 */
export function getConfig(): EnvConfig {
	if (!configInstance) {
		try {
			configInstance = parseEnv();

			// Log configuration in development mode
			if (configInstance.enableDebugMode && import.meta.env.DEV) {
				console.group("🔧 Environment Configuration");
				console.table(configInstance);
				console.groupEnd();
			}
		} catch (error) {
			console.error("Failed to parse environment configuration:", error);
			throw error;
		}
	}

	return configInstance;
}

/**
 * Reset configuration (useful for testing)
 */
export function resetConfig(): void {
	configInstance = null;
}

/**
 * Configuration helpers
 */
export const config = {
	get isDevelopment(): boolean {
		return import.meta.env.DEV;
	},

	get isProduction(): boolean {
		return import.meta.env.PROD;
	},

	get isTest(): boolean {
		return import.meta.env.MODE === "test";
	},

	get apiBaseUrl(): string {
		return getConfig().apiBaseUrl;
	},

	get enableDebugMode(): boolean {
		return getConfig().enableDebugMode;
	},

	get mockDownloads(): boolean {
		return getConfig().mockDownloads;
	},

	get enablePerformanceMonitoring(): boolean {
		return getConfig().enablePerformanceMonitoring;
	},

	get sentryDsn(): string | undefined {
		return getConfig().sentryDsn;
	},
};

export type { EnvConfig };
