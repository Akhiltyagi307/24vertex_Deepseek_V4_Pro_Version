import type { SupabaseClient } from "@supabase/supabase-js";

import { getStudentSubjectsRpc } from "@/lib/student/get-student-subjects-rpc";

/** Stored on `doubt_conversations.metadata` when `topic_id` is null. */
export type DoubtConversationChapterMeta = {
	doubt_scope: "chapter";
	chapter: {
		unit_number: number;
		chapter_number: number;
		chapter_name: string;
		unit_name: string;
	};
};

export type DoubtTopicPayload = {
	id: string;
	unitName: string;
	unitNumber: number;
	chapterName: string;
	chapterNumber: number;
	topicName: string;
	topicNumber: number;
	description: string | null;
	learningObjectives: string[] | null;
	/** Optional runtime grounding packed from `topic_context_chunks` by the route. */
	contextChunksBlock?: string;
};

export type DoubtChapterPayload = {
	unitName: string;
	unitNumber: number;
	chapterName: string;
	chapterNumber: number;
	topicIds: string[];
	/** Bullet list of topic names for the prompt. */
	topicNamesBlock: string;
	topicDescription: string;
	learningObjectivesBlock: string;
	/** Optional runtime grounding packed from `topic_context_chunks` by the route. */
	contextChunksBlock?: string;
};

export type DoubtTopicScopeSuccess = {
	ok: true;
	kind: "topic";
	userId: string;
	studentGrade: number;
	subjectId: string;
	subjectName: string;
	topic: DoubtTopicPayload;
};

export type DoubtChapterScopeSuccess = {
	ok: true;
	kind: "chapter";
	userId: string;
	studentGrade: number;
	subjectId: string;
	subjectName: string;
	chapter: DoubtChapterPayload;
};

export type DoubtScopeSuccess = DoubtTopicScopeSuccess | DoubtChapterScopeSuccess;

export type DoubtScopeFailure = {
	ok: false;
	code:
		| "unauthorized"
		| "not_student"
		| "no_grade"
		| "subject_not_enrolled"
		| "topic_not_found"
		| "topic_mismatch"
		| "chapter_not_found"
		| "invalid_stored_scope"
		| "database_error";
	message: string;
};

export type DoubtScopeResult = DoubtScopeSuccess | DoubtScopeFailure;

type RpcSubjectRow = { id: string; name: string };

const MAX_DESC_SNIPPETS = 6;
const MAX_DESC_TOTAL_CHARS = 1_200;
const MAX_OBJECTIVE_LINES = 28;

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readTrimmedString(...values: unknown[]): string {
	for (const v of values) {
		if (typeof v === "string") {
			const t = v.trim();
			if (t) return t;
		}
	}
	return "";
}

export function parseStoredChapterMeta(metadata: unknown): DoubtConversationChapterMeta | null {
	if (!isRecord(metadata)) return null;
	// Legacy rows may have chapter fields directly on metadata instead of nested.
	const ch = isRecord(metadata.chapter) ? metadata.chapter : metadata;
	const hasCoords =
		ch.unit_number != null ||
		ch.unitNumber != null ||
		ch.chapter_number != null ||
		ch.chapterNumber != null;
	// Accept both the current shape and older rows where `scope` was used.
	const scopeTag = metadata.doubt_scope ?? metadata.scope;
	// If scope is missing but chapter coordinates exist, treat as legacy chapter metadata.
	if (scopeTag !== "chapter" && !hasCoords) return null;
	const unitNumber = Number(ch.unit_number ?? ch.unitNumber);
	const chapterNumber = Number(ch.chapter_number ?? ch.chapterNumber);
	if (!Number.isFinite(unitNumber) || !Number.isFinite(chapterNumber)) {
		return null;
	}
	// Backfill missing names from coordinates so old rows still resolve scope.
	const chapterName =
		readTrimmedString(ch.chapter_name, ch.chapterName) || `Chapter ${Math.trunc(chapterNumber)}`;
	const unitName = readTrimmedString(ch.unit_name, ch.unitName) || `Unit ${Math.trunc(unitNumber)}`;
	return {
		doubt_scope: "chapter",
		chapter: {
			unit_number: unitNumber,
			chapter_number: chapterNumber,
			chapter_name: chapterName,
			unit_name: unitName,
		},
	};
}

async function loadEnrollmentContext(
	supabase: SupabaseClient,
	subjectId: string,
): Promise<
	| { ok: false; failure: DoubtScopeFailure }
	| { ok: true; userId: string; studentGrade: number; subjectName: string }
> {
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();
	if (userError || !user) {
		return { ok: false, failure: { ok: false, code: "unauthorized", message: "Sign in to continue." } };
	}

	const { data: profileRow, error: profileErr } = await supabase
		.from("profiles")
		.select("grade, stream, elective_subject_id, role")
		.eq("id", user.id)
		.maybeSingle();

	if (profileErr || !profileRow || profileRow.role !== "student") {
		return {
			ok: false,
			failure: { ok: false, code: "not_student", message: "This action is only available to students." },
		};
	}

	if (profileRow.grade == null) {
		return {
			ok: false,
			failure: {
				ok: false,
				code: "no_grade",
				message: "Your profile is missing a grade. Complete your account first.",
			},
		};
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
			failure: {
				ok: false,
				code: "database_error",
				message: rpcErr.message ?? "Could not load your subjects.",
			},
		};
	}

	const enrolledIds = new Set(
		((subjectRpcRows ?? []) as RpcSubjectRow[]).map((r) => r.id).filter(Boolean),
	);

	if (!enrolledIds.has(subjectId)) {
		return {
			ok: false,
			failure: {
				ok: false,
				code: "subject_not_enrolled",
				message: "That subject is not part of your enrollment.",
			},
		};
	}

	const subjectName =
		((subjectRpcRows ?? []) as RpcSubjectRow[]).find((r) => r.id === subjectId)?.name ?? null;
	let resolvedName = subjectName;
	if (!resolvedName) {
		const { data: subRow, error: subErr } = await supabase
			.from("subjects")
			.select("name")
			.eq("id", subjectId)
			.maybeSingle();
		if (subErr || !subRow?.name) {
			return {
				ok: false,
				failure: { ok: false, code: "database_error", message: "Could not resolve subject name." },
			};
		}
		resolvedName = subRow.name;
	}

	const trimmedSubjectName = resolvedName?.trim() ?? "";
	if (!trimmedSubjectName) {
		return {
			ok: false,
			failure: { ok: false, code: "database_error", message: "Could not resolve subject name." },
		};
	}

	return {
		ok: true,
		userId: user.id,
		studentGrade,
		subjectName: trimmedSubjectName,
	};
}

function aggregateChapterCurriculum(rows: Array<{
	id: string;
	topic_name: string;
	topic_number: number;
	description: string | null;
	learning_objectives: string[] | null;
	unit_name: string;
	unit_number: number;
	chapter_name: string;
	chapter_number: number;
}>): DoubtChapterPayload {
	const sorted = [...rows].sort((a, b) => a.topic_number - b.topic_number);
	const first = sorted[0]!;
	const topicIds = sorted.map((r) => r.id);
	const topicNamesBlock = sorted.map((r) => `- ${r.topic_name}`).join("\n");

	let descBudget = MAX_DESC_TOTAL_CHARS;
	const descParts: string[] = [];
	for (const r of sorted.slice(0, MAX_DESC_SNIPPETS)) {
		const d = r.description?.trim();
		if (!d) continue;
		const snippet = d.length > descBudget ? `${d.slice(0, descBudget)}…` : d;
		descParts.push(`**${r.topic_name}:** ${snippet}`);
		descBudget -= snippet.length + 4;
		if (descBudget <= 0) break;
	}
	const topicDescription =
		descParts.length > 0
			? descParts.join("\n\n")
			: "(no catalog descriptions for these topics — rely on chapter title and CBSE context)";

	const objectiveSeen = new Set<string>();
	const objectiveLines: string[] = [];
	for (const r of sorted) {
		for (const raw of r.learning_objectives ?? []) {
			const line = raw.trim();
			if (!line) continue;
			const key = line.toLowerCase();
			if (objectiveSeen.has(key)) continue;
			objectiveSeen.add(key);
			objectiveLines.push(`- ${line}`);
			if (objectiveLines.length >= MAX_OBJECTIVE_LINES) break;
		}
		if (objectiveLines.length >= MAX_OBJECTIVE_LINES) break;
	}

	const learningObjectivesBlock =
		objectiveLines.length > 0
			? objectiveLines.join("\n")
			: "(none listed in catalog for these topics)";

	return {
		unitName: first.unit_name,
		unitNumber: first.unit_number,
		chapterName: first.chapter_name,
		chapterNumber: first.chapter_number,
		topicIds,
		topicNamesBlock,
		topicDescription,
		learningObjectivesBlock,
	};
}

/**
 * Verifies enrollment + grade + topic belongs to subject (topic-scoped chat).
 */
export async function validateDoubtTopicScope(
	supabase: SupabaseClient,
	input: { subjectId: string; topicId: string },
): Promise<DoubtScopeResult> {
	const ctx = await loadEnrollmentContext(supabase, input.subjectId);
	if (!ctx.ok) return ctx.failure;

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
	if (topicRow.grade !== ctx.studentGrade) {
		return { ok: false, code: "topic_mismatch", message: "The topic does not match your grade." };
	}

	return {
		ok: true,
		kind: "topic",
		userId: ctx.userId,
		studentGrade: ctx.studentGrade,
		subjectId: input.subjectId,
		subjectName: ctx.subjectName,
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

/** @deprecated Use `validateDoubtTopicScope` — alias kept for gradual refactors. */
export async function validateDoubtScope(
	supabase: SupabaseClient,
	input: { subjectId: string; topicId: string },
): Promise<DoubtScopeResult> {
	return validateDoubtTopicScope(supabase, input);
}

/**
 * Verifies enrollment + that the chapter has at least one active topic in the student's grade.
 */
export async function validateDoubtChapterScope(
	supabase: SupabaseClient,
	input: { subjectId: string; unitNumber: number; chapterNumber: number },
): Promise<DoubtScopeResult> {
	const ctx = await loadEnrollmentContext(supabase, input.subjectId);
	if (!ctx.ok) return ctx.failure;

	const { data: rows, error } = await supabase
		.from("topics")
		.select(
			"id, topic_name, topic_number, description, learning_objectives, unit_name, unit_number, chapter_name, chapter_number, is_active",
		)
		.eq("subject_id", input.subjectId)
		.eq("grade", ctx.studentGrade)
		.eq("unit_number", input.unitNumber)
		.eq("chapter_number", input.chapterNumber)
		.eq("is_active", true)
		.order("topic_number", { ascending: true });

	if (error) {
		return { ok: false, code: "database_error", message: "Could not load chapter topics." };
	}
	if (!rows?.length) {
		return {
			ok: false,
			code: "chapter_not_found",
			message: "That chapter is not available for your grade or subject.",
		};
	}

	return {
		ok: true,
		kind: "chapter",
		userId: ctx.userId,
		studentGrade: ctx.studentGrade,
		subjectId: input.subjectId,
		subjectName: ctx.subjectName,
		chapter: aggregateChapterCurriculum(rows),
	};
}

/**
 * Resolve scope for a persisted conversation row (authoritative for the chat route).
 */
export async function resolveDoubtScopeForConversation(
	supabase: SupabaseClient,
	args: { subjectId: string; topicId: string | null; metadata: unknown },
): Promise<DoubtScopeResult> {
	if (args.topicId) {
		return validateDoubtTopicScope(supabase, { subjectId: args.subjectId, topicId: args.topicId });
	}
	const parsed = parseStoredChapterMeta(args.metadata);
	if (!parsed) {
		return {
			ok: false,
			code: "invalid_stored_scope",
			message: "This chat is missing valid chapter scope.",
		};
	}
	const { unit_number, chapter_number } = parsed.chapter;
	return validateDoubtChapterScope(supabase, {
		subjectId: args.subjectId,
		unitNumber: unit_number,
		chapterNumber: chapter_number,
	});
}

export function buildChapterMetadataPayload(scope: DoubtChapterScopeSuccess): DoubtConversationChapterMeta {
	return {
		doubt_scope: "chapter",
		chapter: {
			unit_number: scope.chapter.unitNumber,
			chapter_number: scope.chapter.chapterNumber,
			chapter_name: scope.chapter.chapterName,
			unit_name: scope.chapter.unitName,
		},
	};
}
