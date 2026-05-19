import type { QnaLogPerformance } from "./types";

function parseScore(value: string | number | null | undefined): number | null {
	if (value == null || value === "") return null;
	const n = typeof value === "number" ? value : Number.parseFloat(String(value));
	return Number.isFinite(n) ? n : null;
}

export function qnaLogScorePercent(value: string | number | null | undefined): number | null {
	const n = parseScore(value);
	return n == null ? null : Math.round(n);
}

export function qnaLogPerformanceFromScore(
	status: "submitted" | "graded",
	scoreValue: string | number | null | undefined,
): QnaLogPerformance {
	if (status === "submitted") return "pending";
	const score = parseScore(scoreValue);
	if (score == null) return "pending";
	if (score >= 85) return "correct";
	if (score >= 25) return "partial";
	return "incorrect";
}
