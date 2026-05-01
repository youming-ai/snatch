import { describe, expect, it } from "bun:test";
import { Cache } from "../src/lib/cache";

describe("Cache", () => {
	it("should store and retrieve values", () => {
		const cache = new Cache<string, string>(3, 60_000);
		cache.put("key1", "value1");
		expect(cache.get("key1")).toBe("value1");
	});

	it("should return undefined for missing keys", () => {
		const cache = new Cache<string, string>(3, 60_000);
		expect(cache.get("nonexistent")).toBeUndefined();
	});

	it("should evict oldest entry when full", () => {
		const cache = new Cache<string, string>(3, 60_000);
		cache.put("key1", "value1");
		cache.put("key2", "value2");
		cache.put("key3", "value3");
		cache.put("key4", "value4"); // Should evict key1

		expect(cache.size).toBe(3);
		expect(cache.get("key1")).toBeUndefined();
		expect(cache.get("key4")).toBe("value4");
	});

	it("should expire entries after TTL", async () => {
		const cache = new Cache<string, string>(10, 50); // 50ms TTL
		cache.put("key1", "value1");
		expect(cache.get("key1")).toBe("value1");

		await Bun.sleep(60);
		expect(cache.get("key1")).toBeUndefined();
	});

	it("should remove entries", () => {
		const cache = new Cache<string, string>(10, 60_000);
		cache.put("key1", "value1");
		expect(cache.remove("key1")).toBe("value1");
		expect(cache.get("key1")).toBeUndefined();
	});

	it("should clear all entries", () => {
		const cache = new Cache<string, string>(10, 60_000);
		cache.put("key1", "value1");
		cache.put("key2", "value2");
		cache.clear();
		expect(cache.size).toBe(0);
	});

	it("should refresh recency on get", () => {
		const cache = new Cache<string, string>(2, 1000);
		cache.put("a", "first");
		cache.put("b", "second");

		expect(cache.get("a")).toBe("first");
		cache.put("c", "third");

		expect(cache.get("a")).toBe("first");
		expect(cache.get("b")).toBeUndefined();
		expect(cache.get("c")).toBe("third");
	});
});
