import type { GradedQuestionItem } from "@/lib/practice/grading-schema";

/** Plain-text block for PDF "How you were scored" section. */
export function formatGradingBreakdownForPdf(
	q: Pick<
		GradedQuestionItem,
		| "band_label"
		| "what_was_correct"
		| "where_marks_were_lost"
		| "to_reach_next_band"
		| "criterion_scores"
		| "score"
	>,
): string {
	const lines: string[] = [];

	if (q.band_label?.trim()) {
		lines.push(`Result: ${q.band_label.trim()}`);
	}

	if (q.what_was_correct?.length) {
		lines.push("", "What you got right:");
		for (const item of q.what_was_correct) {
			lines.push(`• ${item}`);
		}
	}

	if (q.where_marks_were_lost?.length) {
		lines.push("", "Why not full marks:");
		for (const item of q.where_marks_were_lost) {
			lines.push(`• ${item}`);
		}
	}

	if (q.to_reach_next_band?.trim()) {
		lines.push("", `Next step: ${q.to_reach_next_band.trim()}`);
	}

	if (q.criterion_scores?.length) {
		lines.push("", "Marking breakdown:");
		for (const c of q.criterion_scores) {
			lines.push(`• ${c.name}: ${c.points}/20 — ${c.note}`);
		}
	}

	return lines.join("\n").trim();
}
