import type { SupabaseClient } from "@supabase/supabase-js";

import type { FinalizePracticeConfigInput } from "./schemas";
import type { PracticeCanonicalTopic } from "./types";
import type { PracticeRecentError } from "./user-message";

export type PracticeConfigResolveFailure = {
	ok: false;
	code:
		| "unauthorized"
		| "not_student"
		| "subject_not_enrolled"
		| "stale_selection"
		| "subject_mismatch"
		| "inactive_topic"
		| "database_error";
	message: string;
};

export type PracticeConfigResolveSuccess = {
	ok: true;
	userId: string;
	studentGrade: number | null;
	subjectId: string;
	subjectName: string;
	/** Curriculum grade from \`subjects.grade\` (used for prompt band). */
	subjectGrade: number;
	subjectGroup: string | null;
	canonicalTopics: PracticeCanonicalTopic[];
	recentErrors: PracticeRecentError[];
};

export type PracticeConfigResolveResult = PracticeConfigResolveFailure | PracticeConfigResolveSuccess;

function parseScore(v: string | number | null | undefined): number | null {
	if (v == null || v === "") return null;
	const n = typeof v === "number" ? v : Number.parseFloat(String(v));
	return Number.isFinite(n) ? n : null;
}

function normalizeStatus(s: string | null | undefined): string {
	if (s === "good" || s === "satisfactory" || s === "bad" || s === "not_tested") return s;
	return "not_tested";
}

function normalizeTrend(s: string | null | undefined): string {
	if (s === "improving" || s === "declining" || s === "stable") return s;
	return "stable";
}

/**
 * Server-only: verifies enrollment, tracker rows, and topics; builds canonical topic list.
 * Shared by finalize and generate flows.
 */
export async function resolvePracticeConfigForStudent(
	supabase: SupabaseClient,
	input: FinalizePracticeConfigInput,
): Promise<PracticeConfigResolveResult> {
	const { subjectId, trackerIds } = input;

	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();
	if (userError || !user) {
		return { ok: false, code: "unauthorized", message: "Sign in to continue." };
	}

	const { data: profileRow, error: profileErr } = await supabase
		.from("profiles")
		.select("grade, stream, elective_subject_id, role")
		.eq("id", user.id)
		.maybeSingle();

	if (profileErr || !profileRow || profileRow.role !== "student") {
		return { ok: false, code: "not_student", message: "This action is only available to students." };
	}

	const { data: subjectRpcRows, error: rpcErr } = await supabase.rpc("get_student_subjects", {
		p_grade: profileRow.grade,
		p_stream: profileRow.stream,
		p_elective_id: profileRow.elective_subject_id,
	});

	if (rpcErr) {
		return {
			ok: false,
			code: "database_error",
			message: rpcErr.message ?? "Could not load your subjects.",
		};
	}

	type RpcRow = { id: string; name: string };
	const enrolledIds = new Set(
		(subjectRpcRows ?? [])
			.map((row: RpcRow) => row.id)
			.filter((id: string | undefined): id is string => Boolean(id)),
	);

	if (!enrolledIds.has(subjectId)) {
		return {
			ok: false,
			code: "subject_not_enrolled",
			message: "That subject is not part of your enrollment.",
		};
	}

	const { data: subjectRow, error: subjectRowErr } = await supabase
		.from("subjects")
		.select("name, grade, subject_group")
		.eq("id", subjectId)
		.maybeSingle();

	if (subjectRowErr || !subjectRow?.name?.trim() || subjectRow.grade == null) {
		return {
			ok: false,
			code: "database_error",
			message: subjectRowErr?.message ?? "Could not load subject details.",
		};
	}

	const resolvedSubjectName = subjectRow.name.trim();
	const subjectGrade = subjectRow.grade as number;
	const subjectGroup = (subjectRow.subject_group as string | null) ?? null;

	const { data: trackers, error: trackerErr } = await supabase
		.from("performance_tracker")
		.select("id, topic_id, subject_id, status, last_test_date, average_score, tests_taken, trend")
		.eq("student_id", user.id)
		.eq("subject_id", subjectId)
		.in("id", trackerIds);

	if (trackerErr) {
		return {
			ok: false,
			code: "database_error",
			message: trackerErr.message ?? "Could not verify topic selections.",
		};
	}

	if (!trackers || trackers.length !== trackerIds.length) {
		return {
			ok: false,
			code: "stale_selection",
			message: "Some topics are no longer available. Refresh the page and select again.",
		};
	}

	const topicIdSet = [...new Set(trackers.map((t) => t.topic_id as string))];
	const { data: topicRows, error: topicErr } = await supabase
		.from("topics")
		.select("id, topic_name, unit_name, chapter_name, grade, is_active")
		.in("id", topicIdSet);

	if (topicErr || !topicRows?.length) {
		return {
			ok: false,
			code: "database_error",
			message: topicErr?.message ?? "Could not load topic details.",
		};
	}

	const topicById = new Map(topicRows.map((t) => [t.id as string, t]));
	for (const tid of topicIdSet) {
		const row = topicById.get(tid);
		if (!row || row.is_active === false) {
			return {
				ok: false,
				code: "inactive_topic",
				message: "One or more topics are inactive. Refresh and try again.",
			};
		}
	}

	const trackerById = new Map(trackers.map((t) => [t.id as string, t]));
	const canonicalTopics: PracticeCanonicalTopic[] = [];
	for (const trackerId of trackerIds) {
		const tr = trackerById.get(trackerId);
		if (!tr) {
			return {
				ok: false,
				code: "stale_selection",
				message: "Selection order could not be verified. Refresh and try again.",
			};
		}
		if ((tr.subject_id as string) !== subjectId) {
			return {
				ok: false,
				code: "subject_mismatch",
				message: "A selected topic does not belong to this subject.",
			};
		}
		const topic = topicById.get(tr.topic_id as string);
		if (!topic) {
			return {
				ok: false,
				code: "database_error",
				message: "Missing curriculum data for a selected topic.",
			};
		}
		canonicalTopics.push({
			trackerId: tr.id as string,
			topicId: tr.topic_id as string,
			topicName: topic.topic_name as string,
			unitName: topic.unit_name as string,
			chapterName: topic.chapter_name as string,
			grade: topic.grade as number,
			status: normalizeStatus(tr.status as string | null),
			averageScore: parseScore(tr.average_score as string | number | null),
			testsTaken: (tr.tests_taken as number | null) ?? 0,
			trend: normalizeTrend(tr.trend as string | null),
			lastTestDate: (tr.last_test_date as string | null) ?? null,
		});
	}

	// Phase 3: pull up to 8 recent incorrect / partial answers for this subject
	// so the generator can bias toward concepts the student has struggled with.
	// Only include errors whose topic_id is in the student's current selection;
	// otherwise the model may emit topic_ids that fail validateAndStripGeneration.
	const recentErrorsAll = await loadRecentErrorsForSubject(supabase, user.id, subjectId);
	const selectedTopicIds = new Set(canonicalTopics.map((t) => t.topicId));
	const recentErrors = recentErrorsAll.filter((e) => selectedTopicIds.has(e.topic_id));

	return {
		ok: true,
		userId: user.id,
		studentGrade: profileRow.grade ?? null,
		subjectId,
		subjectName: resolvedSubjectName,
		subjectGrade,
		subjectGroup,
		canonicalTopics,
		recentErrors,
	};
}

async function loadRecentErrorsForSubject(
	supabase: SupabaseClient,
	studentId: string,
	subjectId: string,
): Promise<PracticeRecentError[]> {
	const { data: recentTests } = await supabase
		.from("tests")
		.select("id, test_date")
		.eq("student_id", studentId)
		.eq("subject_id", subjectId)
		.eq("status", "graded")
		.order("test_date", { ascending: false })
		.limit(3);

	const testIds = (recentTests ?? []).map((r) => r.id as string);
	if (testIds.length === 0) return [];

	const { data: answerRows } = await supabase
		.from("student_answers")
		.select("test_id, question_id, is_correct, score_earned, ai_feedback")
		.in("test_id", testIds)
		.or("is_correct.eq.false,score_earned.lt.75");
	if (!answerRows?.length) return [];

	const questionIds = [...new Set(answerRows.map((r) => r.question_id as string))];
	if (!questionIds.length) return [];

	const { data: qRows } = await supabase
		.from("questions")
		.select("id, topic_id, question_text")
		.in("id", questionIds);
	if (!qRows?.length) return [];

	const topicIds = [...new Set(qRows.map((r) => r.topic_id as string))];
	const { data: topicRows } = await supabase
		.from("topics")
		.select("id, topic_name")
		.in("id", topicIds);
	const topicNameById = new Map((topicRows ?? []).map((t) => [t.id as string, String(t.topic_name)]));

	const questionById = new Map(qRows.map((q) => [q.id as string, q]));
	const testDateById = new Map((recentTests ?? []).map((t) => [t.id as string, t.test_date as string]));

	const out: PracticeRecentError[] = [];
	for (const a of answerRows) {
		const q = questionById.get(a.question_id as string);
		if (!q) continue;
		const topic_id = q.topic_id as string;
		const topic_name = topicNameById.get(topic_id) ?? "Topic";
		const score = Number.parseFloat((a.score_earned as string | null) ?? "0");
		const verdict: PracticeRecentError["verdict"] =
			a.is_correct === false || Number.isNaN(score) || score < 40 ? "incorrect" : "partially_correct";
		const feedback = (a.ai_feedback as string | null) ?? "";
		const concept = feedback.trim().split(/\r?\n/)[0]?.slice(0, 180) ?? q.question_text?.slice(0, 180) ?? "";
		out.push({
			topic_id,
			topic_name,
			concept,
			verdict,
			last_seen_at: testDateById.get(a.test_id as string) ?? null,
		});
	}

	// Keep most recent first, cap to 8.
	out.sort((x, y) => {
		const xd = x.last_seen_at ? Date.parse(x.last_seen_at) : 0;
		const yd = y.last_seen_at ? Date.parse(y.last_seen_at) : 0;
		return yd - xd;
	});
	return out.slice(0, 8);
}
