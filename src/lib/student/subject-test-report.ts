/** Serialized row from `tests` for subject reports UI and PDF. */
export type SubjectTestRowSerialized = {
	id: string;
	testDate: string | null;
	testType: string | null;
	status: string | null;
	totalScore: string | null;
	totalQuestions: number | null;
	correctAnswers: number | null;
	unitName: string | null;
	difficulty: string | null;
	durationSeconds: number | null;
	isDraft: boolean | null;
	createdAt: string | null;
};

export type TestStatus = "in_progress" | "submitted" | "graded" | "expired";
export type TestType = "self" | "assigned";

export function parseTestRow(r: Record<string, unknown>): SubjectTestRowSerialized {
	return {
		id: String(r.id),
		testDate: r.test_date != null ? String(r.test_date) : null,
		testType: r.test_type != null ? String(r.test_type) : null,
		status: r.status != null ? String(r.status) : null,
		totalScore: r.total_score != null ? String(r.total_score) : null,
		totalQuestions: typeof r.total_questions === "number" ? r.total_questions : null,
		correctAnswers: typeof r.correct_answers === "number" ? r.correct_answers : null,
		unitName: r.unit_name != null ? String(r.unit_name) : null,
		difficulty: r.difficulty != null ? String(r.difficulty) : null,
		durationSeconds: typeof r.duration_seconds === "number" ? r.duration_seconds : null,
		isDraft: typeof r.is_draft === "boolean" ? r.is_draft : null,
		createdAt: r.created_at != null ? String(r.created_at) : null,
	};
}

/** One test row plus subject metadata for the unified student reports table. */
export type StudentReportTestRowSerialized = SubjectTestRowSerialized & {
	subjectId: string;
	subjectName: string;
	subjectSortOrder: number;
};

function soleSubjectEmbed(x: unknown): { id: string; name: string; sort_order: number } | null {
	if (x == null) return null;
	const row = Array.isArray(x) ? x[0] : x;
	if (!row || typeof row !== "object") return null;
	const o = row as Record<string, unknown>;
	const id = o.id != null ? String(o.id) : "";
	const name = o.name != null ? String(o.name) : "";
	const sort =
		typeof o.sort_order === "number"
			? o.sort_order
			: typeof o.sortOrder === "number"
				? o.sortOrder
				: 0;
	return { id, name, sort_order: sort };
}

/** Parses a `tests` row with embedded `subjects` from Supabase. Returns null if `subject_id` is missing. */
export function parseStudentReportTestRow(r: Record<string, unknown>): StudentReportTestRowSerialized | null {
	const base = parseTestRow(r);
	const sub = soleSubjectEmbed(r.subjects);
	const sidFromFk = r.subject_id != null ? String(r.subject_id) : "";
	const subjectId = sidFromFk || sub?.id || "";
	if (!subjectId) return null;
	const subjectName = sub?.name?.trim() ? sub.name : "Unknown subject";
	const subjectSortOrder = sub?.sort_order ?? 0;
	return {
		...base,
		subjectId,
		subjectName,
		subjectSortOrder,
	};
}

export function formatDuration(seconds: number | null | undefined): string {
	if (seconds == null || !Number.isFinite(seconds)) return "—";
	const s = Math.max(0, Math.floor(seconds));
	const m = Math.floor(s / 60);
	const r = s % 60;
	return `${m}:${r.toString().padStart(2, "0")}`;
}

export function formatScorePercent(totalScore: string | null | undefined): string {
	if (totalScore == null || totalScore === "") return "—";
	const n = Number.parseFloat(totalScore);
	if (!Number.isFinite(n)) return "—";
	return `${Math.round(n)}%`;
}

export function parseScoreNumber(totalScore: string | null | undefined): number | null {
	if (totalScore == null || totalScore === "") return null;
	const n = Number.parseFloat(totalScore);
	return Number.isFinite(n) ? n : null;
}

const STATUS_ORDER: Record<string, number> = {
	in_progress: 0,
	submitted: 1,
	graded: 2,
	expired: 3,
};

export function statusSortKey(status: string | null | undefined): number {
	if (status == null) return 99;
	return STATUS_ORDER[status] ?? 50;
}
