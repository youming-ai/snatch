import { isRetryableError } from "@snatch/shared";

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
	operation: () => Promise<T>,
	maxRetries: number = 3,
	initialDelay: number = 500,
): Promise<T> {
	let attempt = 0;
	let delay = initialDelay;

	while (true) {
		try {
			return await operation();
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			attempt++;

			if (attempt >= maxRetries || !isRetryableError(errorMsg)) {
				throw error;
			}

			console.debug(`Operation failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);

			await Bun.sleep(delay);
			delay = Math.min(delay * 2, 30_000);
		}
	}
}
