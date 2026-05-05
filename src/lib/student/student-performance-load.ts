import {
	mergeTrackerWithRelations,
	normalizePerformanceRows,
	type EnrolledSubjectRow,
	type PerformanceRowSerialized,
	type RawTrackerEmbedRow,
} from "@/lib/student/performance-matrix";
import { getCachedTopicCountsBySubjectForGrade } from "@/lib/cache/curriculum-topic-counts";
import { loadStudentSubjects } from "@/lib/student/load-student-subjects";
import type { createClient } from "@/lib/supabase/server";

type RpcSubjectRow = {
	id: string;
	name: string;
	sort_order?: number | null;
};

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type StudentProfileSubjectsRow = {
	grade: number | null;
	stream: string | null;
	elective_subject_id: string | null;
	role: string;
};

const trackerSelect = `
		id,
		topic_id,
		subject_id,
		status,
		last_test_date,
		average_score,
		tests_taken,
		trend,
		updated_at,
		topics (
			id,
			subject_id,
			grade,
			unit_name,
			unit_number,
			chapter_name,
			chapter_number,
			topic_name,
			topic_number
		),
		subjects (
			id,
			name,
			subject_group,
			sort_order
		)
	`;

type TrackerResponse = { data: unknown; error: { message: string } | null };

/** Loads enrolled subjects, topic counts, and normalized tracker rows (same bundle as Performance page). */
export async function loadStudentPerformanceBundle(
	supabase: SupabaseServer,
	userId: string,
	profileRow: StudentProfileSubjectsRow,
): Promise<{
	enrolledSubjects: EnrolledSubjectRow[];
	topicCountBySubjectId: Map<string, number>;
	rows: PerformanceRowSerialized[];
	loadError: string | null;
	/** True when curriculum has topics but tracker rows are empty — client should run session-bound sync then `router.refresh()`. */
	trackerNeedsHydration: boolean;
}> {
	const subjectResult = await loadStudentSubjects(supabase, profileRow);
	const enrolledSubjects: EnrolledSubjectRow[] = subjectResult.subjects
		.map((row: RpcSubjectRow) => ({
			id: row.id,
			name: row.name,
			sort_order: row.sort_order,
		}))
		.filter((s: EnrolledSubjectRow) => Boolean(s.id && s.name));

	const enrolledIds = enrolledSubjects.map((s) => s.id);

	const [topicCountBySubjectId, initialTracker] = await Promise.all([
		profileRow.grade != null && enrolledIds.length > 0 ?
			getCachedTopicCountsBySubjectForGrade(profileRow.grade, enrolledIds)
		:	Promise.resolve(new Map<string, number>()),
		supabase.from("performance_tracker").select(trackerSelect).eq("student_id", userId),
	]);

	let loadError: string | null = subjectResult.loadError;

	let totalCurriculumTopics = 0;
	for (const sid of enrolledIds) {
		totalCurriculumTopics += topicCountBySubjectId.get(sid) ?? 0;
	}

	const trackerNeedsHydration =
		totalCurriculumTopics > 0 &&
		!initialTracker.error &&
		!(initialTracker.data as unknown[] | null)?.length;

	const finalTracker: TrackerResponse = { data: initialTracker.data, error: initialTracker.error };

	const rows = await (async (first: TrackerResponse) => {
		const { data, error } = first;
		if (error) {
			loadError = error.message;
		}

		if (!error && data && (data as unknown[]).length) {
			const normalized = normalizePerformanceRows(data as RawTrackerEmbedRow[]);
			if (normalized.length === (data as unknown[]).length) {
				loadError = null;
				return normalized;
			}
		}

		const { data: trackerOnly, error: err2 } = await supabase
			.from("performance_tracker")
			.select("id, topic_id, subject_id, status, last_test_date, average_score, tests_taken, trend, updated_at")
			.eq("student_id", userId);

		if (err2) {
			loadError = err2.message;
			return [];
		}
		if (!trackerOnly?.length) {
			loadError = null;
			return [];
		}

		const topicIds = [...new Set(trackerOnly.map((r) => r.topic_id))];
		const subjectIds = [...new Set(trackerOnly.map((r) => r.subject_id))];

		const [{ data: topicRows, error: topicErr }, { data: subjectRows, error: subErr }] = await Promise.all([
			supabase
				.from("topics")
				.select(
					"id, subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number",
				)
				.in("id", topicIds),
			supabase.from("subjects").select("id, name, subject_group, sort_order").in("id", subjectIds),
		]);

		if (topicErr || subErr) {
			loadError = topicErr?.message ?? subErr?.message ?? loadError;
			return [];
		}

		const topicsById = new Map((topicRows ?? []).map((t) => [t.id, t]));
		const subjectsById = new Map((subjectRows ?? []).map((s) => [s.id, s]));

		const merged = mergeTrackerWithRelations(trackerOnly, topicsById, subjectsById);
		if (merged.length) {
			loadError = null;
		}
		return merged;
	})(finalTracker);

	return {
		enrolledSubjects,
		topicCountBySubjectId,
		rows,
		loadError,
		trackerNeedsHydration,
	};
}
