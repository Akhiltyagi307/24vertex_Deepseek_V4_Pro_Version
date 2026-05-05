import type {
	PracticeBatchItem,
	PracticeSessionQuestion,
} from "@/components/student/practice/practice-session-types";
import type { SessionStudentAnswer } from "@/lib/practice/practice-session-utils";

export function buildInitialMapsFromInitialAnswers(
	initialAnswers: {
		questionId: string;
		studentAnswer: SessionStudentAnswer | null;
		flaggedForReview: boolean;
	}[],
): {
	answers: Record<string, SessionStudentAnswer>;
	flagged: Record<string, boolean>;
} {
	const answers: Record<string, SessionStudentAnswer> = {};
	const flagged: Record<string, boolean> = {};
	for (const row of initialAnswers) {
		if (row.studentAnswer) {
			answers[row.questionId] = row.studentAnswer;
		}
		flagged[row.questionId] = row.flaggedForReview;
	}
	return { answers, flagged };
}

export function buildBatchItems(
	sortedQs: PracticeSessionQuestion[],
	answers: Record<string, SessionStudentAnswer>,
	flagged: Record<string, boolean>,
): PracticeBatchItem[] {
	const items: PracticeBatchItem[] = [];
	for (const q of sortedQs) {
		const a = answers[q.id];
		if (!a) continue;
		items.push({
			questionId: q.id,
			studentAnswer: a,
			flaggedForReview: flagged[q.id] ?? false,
		});
	}
	return items;
}

export async function batchUpsertPracticeAnswers(body: {
	testId: string;
	items: PracticeBatchItem[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
	try {
		const res = await fetch("/api/student/practice/batch-upsert-answers", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const data = (await res.json()) as { ok?: boolean; message?: string };
		if (!res.ok || !data.ok) {
			return { ok: false, message: data.message ?? "Could not save progress." };
		}
		return { ok: true };
	} catch {
		return { ok: false, message: "Could not save progress. Check your connection." };
	}
}
