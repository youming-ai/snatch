/**
 * Simple in-memory LRU cache with TTL support
 */
interface CacheEntry<V> {
	data: V;
	expiresAt: number;
}

export class Cache<K, V> {
	private data = new Map<K, CacheEntry<V>>();
	private maxSize: number;
	private ttlMs: number;

	constructor(maxSize = 100, ttlMs = 300_000) {
		this.maxSize = maxSize;
		this.ttlMs = ttlMs;
	}

	get(key: K): V | undefined {
		const entry = this.data.get(key);
		if (!entry) return undefined;

		if (Date.now() >= entry.expiresAt) {
			this.data.delete(key);
			return undefined;
		}

		return entry.data;
	}

	put(key: K, value: V): void {
		// Evict oldest if full
		while (this.data.size >= this.maxSize) {
			this.evictOldest();
		}

		this.data.set(key, {
			data: value,
			expiresAt: Date.now() + this.ttlMs,
		});
	}

	remove(key: K): V | undefined {
		const entry = this.data.get(key);
		if (!entry) return undefined;
		this.data.delete(key);
		return entry.data;
	}

	clear(): void {
		this.data.clear();
	}

	get size(): number {
		return this.data.size;
	}

	cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.data.entries()) {
			if (now >= entry.expiresAt) {
				this.data.delete(key);
			}
		}
	}

	private evictOldest(): void {
		let oldestKey: K | undefined;
		let oldestTime = Infinity;

		for (const [key, entry] of this.data.entries()) {
			if (entry.expiresAt < oldestTime) {
				oldestTime = entry.expiresAt;
				oldestKey = key;
			}
		}

		if (oldestKey !== undefined) {
			this.data.delete(oldestKey);
		}
	}
}
