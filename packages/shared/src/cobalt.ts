import type { CobaltOptions } from "./types";

/**
 * Remove optional cobalt fields that have no meaningful value.
 *
 * Cobalt rejects empty strings for optional language/settings fields
 * with `error.api.invalid_body`, so we omit them before serialization.
 */
export function sanitizeCobaltOptions(options: Partial<CobaltOptions>): Partial<CobaltOptions> {
	const result: Partial<CobaltOptions> = {};

	for (const [key, value] of Object.entries(options)) {
		if (value === undefined) {
			continue;
		}
		if (typeof value === "string" && value.trim() === "") {
			continue;
		}
		(result as Record<string, unknown>)[key] = value;
	}

	return result;
}
