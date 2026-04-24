import {
	mergeTrackerWithRelations,
	normalizePerformanceRows,
	type EnrolledSubjectRow,
	type PerformanceRowSerialized,
	type RawTrackerEmbedRow,
} from "@/lib/student/performance-matrix";
import { loadStudentSubjects } from "@/lib/student/load-student-subjects";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
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

	const topicQuery =
		profileRow.grade != null && enrolledIds.length > 0 ?
			supabase
				.from("topics")
				.select("subject_id")
				.eq("grade", profileRow.grade)
				.eq("is_active", true)
				.in("subject_id", enrolledIds)
		:	Promise.resolve({ data: null as { subject_id: string }[] | null, error: null });

	const [topicRes, initialTracker] = await Promise.all([
		topicQuery,
		supabase.from("performance_tracker").select(trackerSelect).eq("student_id", userId),
	]);

	const topicCountBySubjectId = new Map<string, number>();
	if (!topicRes.error && topicRes.data?.length) {
		for (const t of topicRes.data) {
			const sid = t.subject_id as string;
			topicCountBySubjectId.set(sid, (topicCountBySubjectId.get(sid) ?? 0) + 1);
		}
	}

	let loadError: string | null = subjectResult.loadError;

	let totalCurriculumTopics = 0;
	for (const sid of enrolledIds) {
		totalCurriculumTopics += topicCountBySubjectId.get(sid) ?? 0;
	}

	let finalTracker: TrackerResponse = { data: initialTracker.data, error: initialTracker.error };

	if (totalCurriculumTopics > 0 && !initialTracker.error && !(initialTracker.data as unknown[] | null)?.length) {
		const { error: syncError } = await supabase.rpc("sync_student_performance_tracker", {
			p_reset_curriculum: false,
		});
		if (syncError) {
			logSupabaseError("loadStudentPerformanceBundle.sync_student_performance_tracker", syncError, {
				userId,
			});
			loadError ??= "We couldn't refresh your performance tracker right now. Try again.";
		} else {
			const refetch = await supabase.from("performance_tracker").select(trackerSelect).eq("student_id", userId);
			finalTracker = { data: refetch.data, error: refetch.error };
		}
	}

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
	};
}
