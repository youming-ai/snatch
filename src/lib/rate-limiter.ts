import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfig } from "@/config/env";

interface RateLimitData {
	count: number;
	resetTime: number;
}

interface RateLimitStore {
	[clientId: string]: RateLimitData;
}

/**
 * Persistent rate limiter using file-based storage
 * Survives server restarts and works in containerized environments
 */
export class RateLimiter {
	private dbPath: string;
	private window: number;
	private max: number;
	private store: RateLimitStore = {};
	private lastSave: number = 0;
	private saveDebounce: number = 5000; // Save at most every 5 seconds

	constructor(dbPath: string, window: number, max: number) {
		this.dbPath = dbPath;
		this.window = window;
		this.max = max;
		this.load();
		this.startPeriodicSave();
		this.startPeriodicCleanup();
	}

	/**
	 * Load rate limit data from disk
	 */
	private load(): void {
		try {
			if (existsSync(this.dbPath)) {
				const data = readFile(this.dbPath, "utf-8");
				this.store = JSON.parse(data.toString());
			}
		} catch (error) {
			// Only log error in development
			if (import.meta.env.DEV) {
				console.error("Failed to load rate limit data:", error);
			}
			this.store = {};
		}
	}

	/**
	 * Save rate limit data to disk (debounced)
	 */
	private async save(): Promise<void> {
		const now = Date.now();
		if (now - this.lastSave < this.saveDebounce) {
			return;
		}
		this.lastSave = now;

		try {
			const dir = join(this.dbPath, "..");
			if (!existsSync(dir)) {
				await mkdir(dir, { recursive: true });
			}
			await writeFile(this.dbPath, JSON.stringify(this.store), "utf-8");
		} catch (error) {
			// Only log error in development
			if (import.meta.env.DEV) {
				console.error("Failed to save rate limit data:", error);
			}
		}
	}

	/**
	 * Periodically save data to disk
	 */
	private startPeriodicSave(): void {
		setInterval(() => {
			this.save();
		}, this.saveDebounce);
	}

	/**
	 * Periodically clean up expired entries
	 */
	private startPeriodicCleanup(): void {
		setInterval(() => {
			this.cleanup();
		}, 60000); // Every minute
	}

	/**
	 * Remove expired entries from memory
	 */
	private cleanup(): void {
		const now = Date.now();
		let modified = false;

		for (const [clientId, data] of Object.entries(this.store)) {
			if (now >= data.resetTime) {
				delete this.store[clientId];
				modified = true;
			}
		}

		if (modified) {
			this.save();
		}
	}

	/**
	 * Check if a client is rate limited
	 */
	check(clientId: string): { allowed: boolean; resetTime?: number } {
		const now = Date.now();

		// Clean up expired entry for this client
		const existing = this.store[clientId];
		if (existing && now >= existing.resetTime) {
			delete this.store[clientId];
		}

		const entry = this.store[clientId];

		// No entry or expired - initialize
		if (!entry) {
			this.store[clientId] = {
				count: 1,
				resetTime: now + this.window,
			};
			this.save();
			return { allowed: true };
		}

		// Rate limit exceeded
		if (entry.count >= this.max) {
			return {
				allowed: false,
				resetTime: entry.resetTime,
			};
		}

		// Increment count
		entry.count++;
		this.save();
		return { allowed: true };
	}

	/**
	 * Reset rate limit for a specific client (for testing/admin)
	 */
	reset(clientId: string): void {
		delete this.store[clientId];
		this.save();
	}

	/**
	 * Get current rate limit status for a client
	 */
	getStatus(clientId: string): { count: number; resetTime: number } | null {
		const entry = this.store[clientId];
		if (!entry) {
			return null;
		}
		return {
			count: entry.count,
			resetTime: entry.resetTime,
		};
	}

	/**
	 * Close the rate limiter and save final state
	 */
	async close(): Promise<void> {
		await this.save();
	}
}

// Singleton instance
let instance: RateLimiter | null = null;

/**
 * Get the singleton rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
	if (!instance) {
		const config = getConfig();
		const dbPath = process.env.RATE_LIMIT_DB_PATH || "./data/rate-limits.json";
		const window = config.rateLimitWindow;
		const max = config.rateLimitMax;

		instance = new RateLimiter(dbPath, window, max);

		// Only log initialization in development
		if (import.meta.env.DEV) {
			console.log(
				`[RateLimiter] Initialized with window=${window}ms, max=${max}, db=${dbPath}`,
			);
		}
	}
	return instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetRateLimiter(): void {
	if (instance) {
		instance.close();
		instance = null;
	}
}

// Graceful shutdown
if (typeof process !== "undefined") {
	process.on("beforeExit", () => {
		if (instance) {
			instance.close();
		}
	});
}
