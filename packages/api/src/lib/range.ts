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
		// Suffix form: the final N bytes.
		const suffixLength = Number(rawEnd);
		if (!Number.isInteger(suffixLength) || suffixLength <= 0) return "unsatisfiable";
		start = Math.max(0, size - suffixLength);
		end = size - 1;
	} else {
		start = Number(rawStart);
		end = rawEnd === "" ? size - 1 : Number(rawEnd);
	}

	if (!Number.isInteger(start) || !Number.isInteger(end)) return "unsatisfiable";
	if (start > end || start >= size) return "unsatisfiable";
	return { start, end: Math.min(end, size - 1) };
}
