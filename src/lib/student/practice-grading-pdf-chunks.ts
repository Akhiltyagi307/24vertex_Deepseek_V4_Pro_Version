/**
 * Split long plain-text fields across PDF pages (paragraph boundaries first).
 */
const HARD_SPLIT_MIN = 400;

/**
 * Splits `text` into parts each not exceeding `maxChars` (best-effort by paragraphs).
 */
export function chunkTextByMaxChars(text: string, maxChars: number): string[] {
	const t = text.trim();
	if (t.length === 0) return [];
	if (t.length <= maxChars) return [t];
	const paras = t.split(/\n\n+/);
	const chunks: string[] = [];
	let buf = "";
	for (const p of paras) {
		const next = buf ? `${buf}\n\n${p}` : p;
		if (next.length <= maxChars) {
			buf = next;
			continue;
		}
		if (buf) {
			chunks.push(buf);
			buf = "";
		}
		if (p.length <= maxChars) {
			buf = p;
		} else {
			// very long single paragraph: hard split
			for (let i = 0; i < p.length; i += maxChars) {
				chunks.push(p.slice(i, i + maxChars));
			}
		}
	}
	if (buf) chunks.push(buf);
	// If a middle chunk is still too long, flush hard
	const out: string[] = [];
	for (const c of chunks) {
		if (c.length <= maxChars) {
			out.push(c);
			continue;
		}
		for (let i = 0; i < c.length; i += maxChars) {
			out.push(c.slice(i, i + maxChars));
		}
	}
	// Last pass: merge tiny trailing fragments
	return mergeTinyChunks(out, maxChars, HARD_SPLIT_MIN);
}

function mergeTinyChunks(parts: string[], maxChars: number, minMerge: number): string[] {
	if (parts.length <= 1) return parts;
	const merged: string[] = [];
	for (const p of parts) {
		const prev = merged[merged.length - 1];
		if (
			prev != null
			&& p.length < minMerge
			&& prev.length + 2 + p.length <= maxChars
		) {
			merged[merged.length - 1] = `${prev}\n\n${p}`;
		} else {
			merged.push(p);
		}
	}
	return merged;
}

/** First analysis chunk on a question page (after Q + answers) — leave room. */
export const PDF_ANALYSIS_FIRST_MAX = 2200;
/** Continuation pages for analysis / steps. */
export const PDF_BLOCK_CONT_MAX = 4200;
