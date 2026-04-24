/**
 * Builds a Content-Disposition value with RFC 5987 `filename*` (UTF-8) plus a safe ASCII `filename`
 * fallback, avoiding header injection (newlines, quotes) in the filename token.
 */
export function contentDispositionWithFilename(
	type: "inline" | "attachment",
	filename: string,
): string {
	const trimmed = filename.replace(/[\r\n"]/g, "").trim().slice(0, 200);
	const base = trimmed.length > 0 ? trimmed : "download.bin";
	const safeAscii = base.replace(/[^\x20-\x7E]/g, "_") || "download.bin";
	const encoded = encodeURIComponent(base);
	return `${type}; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
}
