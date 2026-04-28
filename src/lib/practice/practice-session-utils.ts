/** Shared helpers for the practice test session UI (client-safe, no React). */

export type PracticeQuestionKind =
	| "multiple_choice"
	| "short_answer"
	| "numerical"
	| "fill_in_blank"
	| "long_answer";

export type SessionStudentAnswer =
	| { kind: "mcq"; value: string }
	| { kind: "text"; value: string }
	| { kind: "numerical"; value: string };

export function optionEntries(options: Record<string, string> | null): Array<[string, string]> {
	if (!options) return [];
	const map = new Map<string, string>();
	for (const [k, v] of Object.entries(options)) {
		map.set(k.trim().toUpperCase(), v);
	}
	const ordered: Array<[string, string]> = [];
	for (const key of ["A", "B", "C", "D"]) {
		const val = map.get(key);
		if (val != null) ordered.push([key, val]);
	}
	for (const [k, v] of map.entries()) {
		if (!["A", "B", "C", "D"].includes(k)) ordered.push([k, v]);
	}
	return ordered;
}

export function questionTypeLabel(t: PracticeQuestionKind): string {
	switch (t) {
		case "multiple_choice":
			return "Multiple choice";
		case "fill_in_blank":
			return "Fill in the blank";
		case "short_answer":
			return "Short answer";
		case "long_answer":
			return "Long answer";
		default:
			return "Numerical";
	}
}

/** Compact label for the question sidebar (number lives in the leading badge). */
export function questionTypeNavLabel(t: PracticeQuestionKind): string {
	switch (t) {
		case "multiple_choice":
			return "MCQ";
		case "fill_in_blank":
			return "Fill in the blank";
		case "short_answer":
			return "Short answer";
		case "long_answer":
			return "Long answer";
		default:
			return "Numerical";
	}
}

/** Normalize DB / API difficulty strings to canonical easy | medium | hard. */
export function normalizeDifficultyLevel(raw: string | null): "easy" | "medium" | "hard" | null {
	if (raw == null || !String(raw).trim()) return null;
	const n = String(raw).trim().toLowerCase();
	if (n === "easy" || n === "medium" || n === "hard") return n;
	return null;
}

/** Pill text: HARD, MEDIUM, EASY (falls back to uppercase raw). */
export function difficultyDisplayLabel(raw: string | null): string {
	const n = normalizeDifficultyLevel(raw);
	if (n) return n.toUpperCase();
	const t = raw?.trim();
	return t ? t.toUpperCase() : "—";
}

/**
 * One line for the question header: chapter and topic when both exist and differ,
 * otherwise the topic title (or chapter) alone.
 */
export function chapterTopicDisplayLabel(chapterName: string | null, topicName: string): string {
	const tp = topicName.trim();
	const ch = chapterName?.trim() ?? "";
	if (!tp && !ch) return "—";
	if (ch && tp && ch.toLowerCase() !== tp.toLowerCase()) return `${ch} · ${tp}`;
	return tp || ch;
}

/** Approximate visible text length for progress UI (strips HTML from rich written answers). */
export function writtenAnswerPlainLen(raw: string): number {
	return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length;
}

export function isAnswered(
	q: { question_type: PracticeQuestionKind },
	a: SessionStudentAnswer | undefined,
): boolean {
	if (!a) return false;
	if (a.kind === "mcq") return a.value.trim().length > 0;
	if (a.kind === "text") return writtenAnswerPlainLen(a.value) > 0;
	return a.value.trim().length > 0;
}
