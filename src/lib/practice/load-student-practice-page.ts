import "server-only";

import type {
	PracticeEnrolledSubject,
	PracticeSubjectProgress,
} from "@/components/student/practice/practice-test-wizard";
import {
	mergeTrackerWithRelations,
	normalizePerformanceRows,
	type PerformanceRowSerialized,
	type RawTrackerEmbedRow,
} from "@/lib/student/performance-matrix";
import { loadStudentSubjects } from "@/lib/student/load-student-subjects";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

type RpcSubjectRow = {
	id: string;
	name: string;
	sort_order?: number | null;
	subject_group?: string | null;
};

export type StudentPracticePageProfileRow = {
	grade: number | null;
	stream: string | null;
	elective_subject_id: string | null;
	role: string;
};

function writtenAnswerPlainLen(s: string): number {
	return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length;
}

function isAnswerPayloadAnswered(raw: unknown): boolean {
	if (!raw || typeof raw !== "object") return false;
	const o = raw as { kind?: unknown; value?: unknown };
	if (typeof o.value !== "string") return false;
	if (o.kind === "text") return writtenAnswerPlainLen(o.value) > 0;
	return o.value.trim().length > 0;
}

async function loadPracticeProgressBySubject(
	supabase: SupabaseServer,
	studentId: string,
): Promise<{
	progressBySubjectId: Record<string, PracticeSubjectProgress>;
	loadError: string | null;
}> {
	const callWithParam = () =>
		supabase.rpc("practice_subject_progress", {
			p_student_id: studentId,
		});
	const callWithAuthUid = () => supabase.rpc("practice_subject_progress");

	let { data, error } = await callWithParam();
	if (error?.code === "PGRST202") {
		// Some DBs expose the same RPC with a different arg name; fallback to auth.uid().
		const fallback = await callWithAuthUid();
		data = fallback.data;
		error = fallback.error;
	}

	if (error) {
		logSupabaseError("loadPracticeProgressBySubject.practice_subject_progress", error, {
			studentId,
		});
		const legacy = await loadPracticeProgressBySubjectLegacy(supabase, studentId);
		return {
			progressBySubjectId: legacy,
			loadError: "We couldn't fully refresh your in-progress practice state. Some progress may be stale.",
		};
	}

	const out: Record<string, PracticeSubjectProgress> = {};
	for (const row of (data ?? []) as Array<{
		subject_id: string;
		test_id: string;
		answered_count: number;
		total_questions: number;
		time_limit_seconds: number | null;
		started_at: string | null;
		topics_covered: number | null;
		last_test_score: string | number | null;
	}>) {
		const score = row.last_test_score;
		const scoreNum =
			typeof score === "number" ? score : score != null ? Number.parseFloat(String(score)) : null;
		out[row.subject_id] = {
			testId: row.test_id,
			answeredCount: row.answered_count,
			totalQuestions: row.total_questions,
			timeLimitSeconds: row.time_limit_seconds,
			startedAt: row.started_at,
			topicsCovered: row.topics_covered,
			lastTestScore: scoreNum != null && Number.isFinite(scoreNum) ? scoreNum : null,
		};
	}
	return { progressBySubjectId: out, loadError: null };
}

async function loadPracticeProgressBySubjectLegacy(
	supabase: SupabaseServer,
	studentId: string,
): Promise<Record<string, PracticeSubjectProgress>> {
	const { data: inProgressTests } = await supabase
		.from("tests")
		.select("id, subject_id, total_questions, updated_at, started_at, time_limit_seconds")
		.eq("student_id", studentId)
		.eq("status", "in_progress")
		.eq("test_type", "self");
	if (!inProgressTests?.length) return {};

	const testIds = inProgressTests.map((t) => t.id as string);
	const [{ data: answerRows }, { data: qRows }] = await Promise.all([
		supabase.from("student_answers").select("test_id, student_answer").in("test_id", testIds),
		supabase.from("questions").select("test_id, topic_id").in("test_id", testIds),
	]);
	const answeredByTest = new Map<string, number>();
	for (const row of answerRows ?? []) {
		const tid = row.test_id as string;
		if (!isAnswerPayloadAnswered(row.student_answer)) continue;
		answeredByTest.set(tid, (answeredByTest.get(tid) ?? 0) + 1);
	}
	const perTestQuestions = new Map<string, number>();
	const perTestTopics = new Map<string, Set<string>>();
	for (const r of qRows ?? []) {
		const tid = r.test_id as string;
		perTestQuestions.set(tid, (perTestQuestions.get(tid) ?? 0) + 1);
		if (!perTestTopics.has(tid)) perTestTopics.set(tid, new Set());
		perTestTopics.get(tid)!.add(r.topic_id as string);
	}

	const sorted = [...inProgressTests].sort(
		(a, b) =>
			new Date((b.updated_at as string) ?? 0).getTime() -
			new Date((a.updated_at as string) ?? 0).getTime(),
	);
	const bySubject = new Map<string, PracticeSubjectProgress>();
	for (const t of sorted) {
		const sid = t.subject_id as string;
		if (bySubject.has(sid)) continue;
		const tid = t.id as string;
		const totalRaw = t.total_questions;
		const totalQuestions =
			typeof totalRaw === "number" && totalRaw > 0 ? totalRaw : perTestQuestions.get(tid) ?? 0;
		bySubject.set(sid, {
			testId: tid,
			answeredCount: answeredByTest.get(tid) ?? 0,
			totalQuestions,
			timeLimitSeconds: (t.time_limit_seconds as number | null) ?? null,
			startedAt: (t.started_at as string | null) ?? null,
			topicsCovered: perTestTopics.get(tid)?.size ?? null,
			lastTestScore: null,
		});
	}
	return Object.fromEntries(bySubject);
}

const performanceTrackerSelect = `
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

export type StudentPracticePagePayload = {
	enrolledSubjects: PracticeEnrolledSubject[];
	loadError: string | null;
	performanceRows: PerformanceRowSerialized[];
	showPromptPreview: boolean;
	subjectProgressBySubjectId: Record<string, PracticeSubjectProgress>;
	isAdmin: boolean;
	/** Used by the wizard's draft persistence cache key. */
	userId: string;
};

/** NormalizePerformanceRows returns PerformanceRowSerialized[] */
export async function loadStudentPracticePagePayload(
	supabase: SupabaseServer,
	userId: string,
	profileRow: StudentPracticePageProfileRow,
): Promise<StudentPracticePagePayload> {
	const subjectResult = await loadStudentSubjects(supabase, profileRow);
	const enrolledSubjects: PracticeEnrolledSubject[] = subjectResult.subjects
		.map((row: RpcSubjectRow) => ({
			id: row.id,
			name: row.name,
			sort_order: row.sort_order ?? 0,
			subject_group: row.subject_group ?? null,
		}))
		.filter((s: PracticeEnrolledSubject) => Boolean(s.id && s.name));

	enrolledSubjects.sort((a: PracticeEnrolledSubject, b: PracticeEnrolledSubject) => {
		const ga = a.subject_group ?? "\uffff";
		const gb = b.subject_group ?? "\uffff";
		if (ga !== gb) return ga.localeCompare(gb);
		if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
		return a.name.localeCompare(b.name);
	});

	let loadError: string | null = subjectResult.loadError;

	const [rows, practiceProgress] = await Promise.all([
		(async () => {
			const { data, error } = await supabase
				.from("performance_tracker")
				.select(performanceTrackerSelect)
				.eq("student_id", userId);

			if (error) {
				loadError = error.message;
			}

			if (!error && data?.length) {
				const normalized = normalizePerformanceRows(data as RawTrackerEmbedRow[]);
				if (normalized.length === data.length) {
					loadError = null;
					return normalized;
				}
			}

			const { data: trackerOnly, error: err2 } = await supabase
				.from("performance_tracker")
				.select(
					"id, topic_id, subject_id, status, last_test_date, average_score, tests_taken, trend, updated_at",
				)
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
		})(),
		loadPracticeProgressBySubject(supabase, userId),
	]);
	loadError ??= practiceProgress.loadError;

	const isAdmin = false;
	const showPromptPreview =
		process.env.PRACTICE_PROMPT_PREVIEW === "true" && process.env.NODE_ENV !== "production";

	return {
		enrolledSubjects,
		loadError,
		performanceRows: rows,
		showPromptPreview,
		subjectProgressBySubjectId: practiceProgress.progressBySubjectId,
		isAdmin,
		userId,
	};
}
