export interface EnvConfig {
	rateLimitMax: number;
	rateLimitWindow: number;
}

function parseEnv(): EnvConfig {
	const getNumber = (key: string, defaultValue: number): number => {
		const value = import.meta.env[key];
		if (value === undefined) return defaultValue;
		const parsed = Number.parseInt(value, 10);
		return Number.isNaN(parsed) ? defaultValue : parsed;
	};

	return {
		rateLimitMax: getNumber("PUBLIC_RATE_LIMIT_MAX", 10),
		rateLimitWindow: getNumber("PUBLIC_RATE_LIMIT_WINDOW", 60000),
	};
}

let configInstance: EnvConfig | null = null;

export function getConfig(): EnvConfig {
	if (!configInstance) {
		configInstance = parseEnv();
	}
	return configInstance;
}
