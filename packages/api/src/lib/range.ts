/** A resolved byte range, inclusive at both ends. */
export interface ByteRange {
	start: number;
	end: number;
}

/**
 * Resolve an HTTP `Range` header against a known body size.
 *
 * `null` means "no usable range" — no header, or a form we do not claim to
 * support (non-byte units, multiple ranges) — and the caller should answer 200
 * with the whole body. `"unsatisfiable"` means the client asked for bytes that
 * do not exist and must be answered with 416.
 *
 * Single byte ranges are worth supporting because that is what browsers,
 * download managers and a resumed `<a download>` send.
 */
export function parseRange(
	header: string | undefined,
	size: number,
): ByteRange | null | "unsatisfiable" {
	if (!header) return null;

	const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
	if (!match) return null;

	const rawStart = match[1] ?? "";
	const rawEnd = match[2] ?? "";
	if (rawStart === "" && rawEnd === "") return null;

	let start: number;
	let end: number;
	if (rawStart === "") {
		// Suffix form: the final N bytes, or the whole file when N is larger than
		// it — a suffix length too big for a JS number lands here too, which is
		// "at least the file size" by definition rather than an impossibility.
		const suffixLength = Number(rawEnd);
		if (Number.isNaN(suffixLength) || suffixLength <= 0) return "unsatisfiable";
		start = Number.isFinite(suffixLength) ? Math.max(0, size - Math.floor(suffixLength)) : 0;
		end = size - 1;
	} else {
		start = Number(rawStart);
		if (!Number.isInteger(start) || start >= size) return "unsatisfiable";

		// RFC 9110: an end past the last byte is the remainder of the file, not a
		// rejection, and an overflowed one means the same thing.
		const requestedEnd = rawEnd === "" ? size - 1 : Number(rawEnd);
		if (Number.isNaN(requestedEnd)) return "unsatisfiable";
		const clampedEnd = Number.isFinite(requestedEnd) ? Math.floor(requestedEnd) : size - 1;
		end = Math.min(clampedEnd, size - 1);
	}

	if (start > end) return "unsatisfiable";
	return { start, end };
}
