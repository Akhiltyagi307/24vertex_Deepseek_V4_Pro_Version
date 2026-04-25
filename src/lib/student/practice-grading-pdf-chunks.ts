/**
 * Split long plain-text fields across PDF pages (paragraph boundaries first).
 */
const HARD_SPLIT_MIN = 400;

const TRUNCATION_NOTE =
	"\n\n[Full detail is available in the in-app report for this practice test.]";

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
			for (let i = 0; i < p.length; i += maxChars) {
				chunks.push(p.slice(i, i + maxChars));
			}
		}
	}
	if (buf) chunks.push(buf);
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

/** Budget for AI feedback text on page 1 (after question, your answer, generation block). */
export const PDF_PAGE1_FEEDBACK_MAX = 1800;
/** Budget for overflow AI feedback on page 2. */
export const PDF_PAGE2_FEEDBACK_MAX = 4500;
/** Max characters for the generation / answer key card on page 1 (truncate with note if over). */
export const PDF_GENERATION_BLOCK_MAX = 3500;

export type TwoPageFeedbackSplit = {
	page1: string;
	page2: string | null;
	wasTruncated: boolean;
};

/**
 * Merges analysis + step-by-step, then splits to at most two parts for two PDF pages.
 * Page 1 gets the first chunk (max PDF_PAGE1_FEEDBACK_MAX); all remaining text goes on page 2
 * (max PDF_PAGE2_FEEDBACK_MAX). If still too long, truncates and appends TRUNCATION_NOTE.
 */
export function splitFeedbackForTwoQuestionPages(
	analysis: string,
	stepByStep: string | undefined,
): TwoPageFeedbackSplit {
	const a = analysis.trim();
	const s = stepByStep?.trim();
	const full =
		a && s ? `${a}\n\nStep-by-step:\n${s}`
		: a ? a
		: s ? `Step-by-step:\n${s}`
		: "";

	if (!full) {
		return { page1: "", page2: null, wasTruncated: false };
	}

	const pass1 = chunkTextByMaxChars(full, PDF_PAGE1_FEEDBACK_MAX);
	if (pass1.length === 0) {
		return { page1: "", page2: null, wasTruncated: false };
	}

	const page1 = pass1[0] ?? "";
	const remainder = pass1.length > 1 ? pass1.slice(1).join("\n\n").trim() : "";
	if (!remainder) {
		return { page1, page2: null, wasTruncated: false };
	}

	if (remainder.length <= PDF_PAGE2_FEEDBACK_MAX) {
		return { page1, page2: remainder, wasTruncated: false };
	}

	const cap = Math.max(0, PDF_PAGE2_FEEDBACK_MAX - TRUNCATION_NOTE.length);
	const page2 = `${remainder.slice(0, cap).trimEnd()}${TRUNCATION_NOTE}`;
	return { page1, page2, wasTruncated: true };
}

/**
 * Truncates long generation / answer key text to fit the first question page.
 */
export function clampGenerationBlockForPdf(text: string): { text: string; wasTruncated: boolean } {
	const t = text.trim();
	if (t.length <= PDF_GENERATION_BLOCK_MAX) {
		return { text: t, wasTruncated: false };
	}
	const cut = t.slice(0, PDF_GENERATION_BLOCK_MAX - TRUNCATION_NOTE.length);
	return {
		text: `${cut.trimEnd()}${TRUNCATION_NOTE}`,
		wasTruncated: true,
	};
}
