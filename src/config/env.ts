/**
 * Environment configuration management
 * Centralizes all environment variables with type safety and validation
 */

// Configuration schema definition
interface EnvConfig {
	// Security
	rateLimitMax: number;
	rateLimitWindow: number;

	// Feature flags
	enableDebugMode: boolean;

	// Third-party services
	sentryDsn?: string;
}

/**
 * Parse and validate environment variables
 */
function parseEnv(): EnvConfig {
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
		if (Number.isNaN(parsed)) {
			console.warn(
				`Invalid number for ${key}: ${value}, using default: ${defaultValue}`,
			);
			return defaultValue;
		}
		return parsed;
	};

	return {
		// Security
		rateLimitMax: getNumber("VITE_RATE_LIMIT_MAX", 10),
		rateLimitWindow: getNumber("VITE_RATE_LIMIT_WINDOW", 60000),

		// Feature flags
		enableDebugMode: getBoolean("VITE_ENABLE_DEBUG_MODE", true),

		// Third-party services
		sentryDsn: getOptional("VITE_SENTRY_DSN") || undefined,
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

	get enableDebugMode(): boolean {
		return getConfig().enableDebugMode;
	},

	get sentryDsn(): string | undefined {
		return getConfig().sentryDsn;
	},

	// Removed unused properties:
	// - apiBaseUrl (not used in current implementation)
	// - mockDownloads (not used)
	// - enablePerformanceMonitoring (not used)
};

export type { EnvConfig };

