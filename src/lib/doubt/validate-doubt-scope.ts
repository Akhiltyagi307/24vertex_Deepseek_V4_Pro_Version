import type { SupabaseClient } from "@supabase/supabase-js";

import { getStudentSubjectsRpc } from "@/lib/student/get-student-subjects-rpc";

export type DoubtScopeSuccess = {
	ok: true;
	userId: string;
	studentGrade: number;
	subjectId: string;
	subjectName: string;
	topic: {
		id: string;
		unitName: string;
		unitNumber: number;
		chapterName: string;
		chapterNumber: number;
		topicName: string;
		topicNumber: number;
		description: string | null;
		learningObjectives: string[] | null;
	};
};

export type DoubtScopeFailure = {
	ok: false;
	code:
		| "unauthorized"
		| "not_student"
		| "no_grade"
		| "subject_not_enrolled"
		| "topic_not_found"
		| "topic_mismatch"
		| "database_error";
	message: string;
};

export type DoubtScopeResult = DoubtScopeSuccess | DoubtScopeFailure;

type RpcSubjectRow = { id: string; name: string };

/**
 * Verifies the student is enrolled in the subject and the topic exists, matches grade, and belongs to the subject.
 */
export async function validateDoubtScope(
	supabase: SupabaseClient,
	input: { subjectId: string; topicId: string },
): Promise<DoubtScopeResult> {
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

	if (profileRow.grade == null) {
		return { ok: false, code: "no_grade", message: "Your profile is missing a grade. Complete your account first." };
	}

	const studentGrade = profileRow.grade;

	const { data: subjectRpcRows, error: rpcErr } = await getStudentSubjectsRpc<RpcSubjectRow>(supabase, {
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

	const enrolledIds = new Set(
		((subjectRpcRows ?? []) as RpcSubjectRow[]).map((r) => r.id).filter(Boolean),
	);

	if (!enrolledIds.has(input.subjectId)) {
		return {
			ok: false,
			code: "subject_not_enrolled",
			message: "That subject is not part of your enrollment.",
		};
	}

	const subjectName =
		((subjectRpcRows ?? []) as RpcSubjectRow[]).find((r) => r.id === input.subjectId)?.name ?? null;
	let resolvedName = subjectName;
	if (!resolvedName) {
		const { data: subRow, error: subErr } = await supabase
			.from("subjects")
			.select("name")
			.eq("id", input.subjectId)
			.maybeSingle();
		if (subErr || !subRow?.name) {
			return { ok: false, code: "database_error", message: "Could not resolve subject name." };
		}
		resolvedName = subRow.name;
	}

	const { data: topicRow, error: topicErr } = await supabase
		.from("topics")
		.select(
			"id, subject_id, grade, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number, description, learning_objectives, is_active",
		)
		.eq("id", input.topicId)
		.maybeSingle();

	if (topicErr) {
		return { ok: false, code: "database_error", message: "Could not load topic." };
	}
	if (!topicRow) {
		return { ok: false, code: "topic_not_found", message: "That topic was not found." };
	}

	if (!topicRow.is_active) {
		return { ok: false, code: "topic_mismatch", message: "That topic is not available." };
	}
	if (topicRow.subject_id !== input.subjectId) {
		return { ok: false, code: "topic_mismatch", message: "The topic does not match the selected subject." };
	}
	if (topicRow.grade !== studentGrade) {
		return { ok: false, code: "topic_mismatch", message: "The topic does not match your grade." };
	}

	if (resolvedName == null || resolvedName === "") {
		return { ok: false, code: "database_error", message: "Could not resolve subject name." };
	}

	return {
		ok: true,
		userId: user.id,
		studentGrade,
		subjectId: input.subjectId,
		subjectName: resolvedName,
		topic: {
			id: topicRow.id,
			unitName: topicRow.unit_name,
			unitNumber: topicRow.unit_number,
			chapterName: topicRow.chapter_name,
			chapterNumber: topicRow.chapter_number,
			topicName: topicRow.topic_name,
			topicNumber: topicRow.topic_number,
			description: topicRow.description,
			learningObjectives: topicRow.learning_objectives,
		},
	};
}
