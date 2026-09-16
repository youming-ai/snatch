import { describe, expect, it } from "bun:test";
import { parseRange } from "../src/lib/range";

describe("parseRange", () => {
	it("has nothing to do without a range header", () => {
		expect(parseRange(undefined, 100)).toBeNull();
	});

	it("resolves a closed range", () => {
		expect(parseRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
	});

	it("resolves an open-ended range to the last byte", () => {
		expect(parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
	});

	it("resolves a suffix range to the final N bytes", () => {
		expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
	});

	it("clamps a suffix range longer than the file", () => {
		expect(parseRange("bytes=-500", 100)).toEqual({ start: 0, end: 99 });
	});

	it("clamps an end past the last byte", () => {
		expect(parseRange("bytes=90-999", 100)).toEqual({ start: 90, end: 99 });
	});

	it("treats a range starting past the end as unsatisfiable", () => {
		expect(parseRange("bytes=100-200", 100)).toBe("unsatisfiable");
		expect(parseRange("bytes=0-1", 0)).toBe("unsatisfiable");
	});

	it("treats an inverted range as unsatisfiable", () => {
		expect(parseRange("bytes=9-1", 100)).toBe("unsatisfiable");
	});

	it("ignores forms it does not support rather than failing the request", () => {
		expect(parseRange("bytes=0-1,5-6", 100)).toBeNull();
		expect(parseRange("items=0-1", 100)).toBeNull();
		expect(parseRange("bytes=abc-def", 100)).toBeNull();
		expect(parseRange("bytes=-", 100)).toBeNull();
	});

	it("rejects a bound that is not a finite integer", () => {
		expect(parseRange(`bytes=0-${"9".repeat(400)}`, 100)).toBe("unsatisfiable");
	});
});
