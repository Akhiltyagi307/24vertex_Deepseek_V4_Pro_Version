import "server-only";

import type { UIMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isDoubtTutorMode, type DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";
import { getEntitlements, type EntitlementSnapshot } from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/server";
import { isPostgresUndefinedColumnError, logSupabaseError } from "@/lib/server/log-supabase-error";
import {
	averageTestScorePercentForSubject,
	buildSubjectCardTrackerStats,
	dominantStatusFromTrackerStats,
	emptySubjectCardTrackerStats,
	type PerformanceRowSerialized,
	type TrackerStatus,
} from "@/lib/student/performance-matrix";
import { loadStudentPerformanceBundle } from "@/lib/student/student-performance-load";
import { loadStudentSubjects, type StudentSubjectsProfileRow } from "@/lib/student/load-student-subjects";
import { parseStoredChapterMeta } from "@/lib/doubt/validate-doubt-scope";
import type { AttachmentRow } from "@/lib/doubt/attachments/types";

/**
 * Slimmed entitlement view used by the doubt-chat composer's quota meter — we
 * only need the three numbers, not the full snapshot. Keeps the UI prop tight.
 */
export type DoubtChatEntitlement = {
	tokensUsed: number;
	tokensQuota: number;
	tokensLeft: number;
};

function toDoubtChatEntitlement(snapshot: EntitlementSnapshot | null): DoubtChatEntitlement {
	if (!snapshot) {
		return { tokensUsed: 0, tokensQuota: 0, tokensLeft: 0 };
	}
	return {
		tokensUsed: snapshot.tokensUsed,
		tokensQuota: snapshot.tokensQuota,
		tokensLeft: snapshot.tokensLeft,
	};
}

export type DoubtChatTopicRow = {
	id: string;
	subjectId: string;
	unitName: string;
	unitNumber: number;
	chapterName: string;
	chapterNumber: number;
	topicName: string;
	topicNumber: number;
};

export type DoubtChatConversationRow = {
	id: string;
	title: string | null;
	updatedAt: string;
	subjectName: string;
};

/**
 * Performance slices for doubt scope picker (subject avg + status, chapter weak counts, topic status).
 */
export type DoubtPickerPerformance = {
	bySubjectId: Record<
		string,
		{
			avgScorePercent: number | null;
			dominantStatus: ReturnType<typeof dominantStatusFromTrackerStats>;
			weakTopicCount: number;
		}
	>;
	topicStatusById: Record<string, TrackerStatus>;
	/**
	 * Key `${subjectId}:${unitNumber}:${chapterNumber}` → count of topics that need improvement
	 * (practice status is developing or below target). Untested topics are not counted.
	 */
	needsImprovementCountByChapterKey: Record<string, number>;
};

function buildDoubtPickerPerformance(
	rows: PerformanceRowSerialized[],
	enrolledSubjectIds: string[],
): DoubtPickerPerformance {
	const topicStatusById: Record<string, TrackerStatus> = {};
	const needsImprovementCountByChapterKey: Record<string, number> = {};
	for (const r of rows) {
		topicStatusById[r.topicId] = r.status;
		if (r.status === "satisfactory" || r.status === "bad") {
			const ck = `${r.subjectId}:${r.unitNumber}:${r.chapterNumber}`;
			needsImprovementCountByChapterKey[ck] =
				(needsImprovementCountByChapterKey[ck] ?? 0) + 1;
		}
	}
	const trackerMap = buildSubjectCardTrackerStats(rows);
	const bySubjectId: DoubtPickerPerformance["bySubjectId"] = {};
	for (const sid of enrolledSubjectIds) {
		const st = trackerMap.get(sid) ?? emptySubjectCardTrackerStats;
		let weakTopicCount = 0;
		for (const r of rows) {
			if (r.subjectId === sid && r.status !== "good") {
				weakTopicCount += 1;
			}
		}
		bySubjectId[sid] = {
			avgScorePercent: averageTestScorePercentForSubject(rows, sid),
			dominantStatus: dominantStatusFromTrackerStats(st),
			weakTopicCount,
		};
	}
	return { bySubjectId, topicStatusById, needsImprovementCountByChapterKey };
}

/**
 * All active topics for a subject and the student's profile grade.
 */
export async function loadDoubtTopicRows(
	subjectId: string,
	profile: Pick<StudentSubjectsProfileRow, "grade" | "stream" | "elective_subject_id">,
): Promise<DoubtChatTopicRow[]> {
	const supabase = await createClient();
	if (profile.grade == null) {
		return [];
	}
	const { data, error } = await supabase
		.from("topics")
		.select("id, subject_id, unit_name, unit_number, chapter_name, chapter_number, topic_name, topic_number, is_active")
		.eq("subject_id", subjectId)
		.eq("grade", profile.grade)
		.eq("is_active", true)
		.order("unit_number", { ascending: true })
		.order("chapter_number", { ascending: true })
		.order("topic_number", { ascending: true });

	if (error) {
		logSupabaseError("loadDoubtTopicRows", error, { subjectId });
		return [];
	}
	return (data ?? []).map((r) => ({
		id: r.id,
		subjectId: r.subject_id,
		unitName: r.unit_name,
		unitNumber: r.unit_number,
		chapterName: r.chapter_name,
		chapterNumber: r.chapter_number,
		topicName: r.topic_name,
		topicNumber: r.topic_number,
	}));
}

export async function loadDoubtConversationsList(studentId: string): Promise<DoubtChatConversationRow[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("doubt_conversations")
		.select("id, title, updated_at, subjects(name)")
		.eq("student_id", studentId)
		.order("updated_at", { ascending: false })
		.limit(50);

	if (error) {
		logSupabaseError("loadDoubtConversationsList", error, { studentId });
		return [];
	}
	return (data ?? []).map((r) => {
		const sub = r.subjects as { name: string } | { name: string }[] | null;
		const name = Array.isArray(sub) ? sub[0]?.name : sub?.name;
		return {
			id: r.id,
			title: r.title,
			updatedAt: r.updated_at ?? new Date().toISOString(),
			subjectName: name?.trim() || "Subject",
		};
	});
}

export async function loadDoubtPageBundle(userId: string) {
	const supabase = await createClient();
	const { data: profileRow, error: profileErr } = await supabase
		.from("profiles")
		.select("grade, stream, elective_subject_id, role")
		.eq("id", userId)
		.maybeSingle();

	if (profileErr || !profileRow || profileRow.role !== "student") {
		return { ok: false as const, code: "not_student" as const };
	}

	const subj = await loadStudentSubjects(supabase, profileRow);
	const conversations = await loadDoubtConversationsList(userId);
	const entitlement = toDoubtChatEntitlement(await getEntitlements(supabase, userId));

	const perfBundle = await loadStudentPerformanceBundle(supabase, userId, {
		grade: profileRow.grade,
		stream: profileRow.stream,
		elective_subject_id: profileRow.elective_subject_id,
		role: profileRow.role,
	});

	const enrolledIdsForPerf = perfBundle.enrolledSubjects.map((s) => s.id);
	const doubtPickerPerformance = buildDoubtPickerPerformance(perfBundle.rows, enrolledIdsForPerf);

	return {
		ok: true as const,
		profile: profileRow,
		subjects: subj.subjects,
		subjectsLoadError: subj.loadError,
		conversations,
		entitlement,
		doubtPickerPerformance,
		performanceLoadError: perfBundle.loadError,
	};
}

/** Server-side bundle for a known student profile id (parent must be linked via RLS). */
export async function loadDoubtPageBundleForStudentProfile(studentId: string) {
	const supabase = await createClient();
	const { data: profileRow, error: profileErr } = await supabase
		.from("profiles")
		.select("grade, stream, elective_subject_id, role")
		.eq("id", studentId)
		.maybeSingle();

	if (profileErr || !profileRow || profileRow.role !== "student") {
		return { ok: false as const, code: "not_student" as const };
	}

	const subj = await loadStudentSubjects(supabase, profileRow);
	const conversations = await loadDoubtConversationsList(studentId);

	return {
		ok: true as const,
		profile: profileRow,
		subjects: subj.subjects,
		subjectsLoadError: subj.loadError,
		conversations,
	};
}

export type LoadedDoubtConversation = {
	id: string;
	studentId: string;
	subjectId: string;
	topicId: string | null;
	title: string | null;
	subjectName: string | null;
	topicName: string | null;
	chapterName: string | null;
};

export async function loadDoubtConversationForStudent(
	conversationId: string,
	studentId: string,
): Promise<LoadedDoubtConversation | null> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("doubt_conversations")
		.select(
			"id, student_id, subject_id, topic_id, title, metadata, subjects(name), topics(topic_name, chapter_name)",
		)
		.eq("id", conversationId)
		.maybeSingle();
	if (error) {
		logSupabaseError("loadDoubtConversationForStudent", error, { conversationId });
		return null;
	}
	if (!data || data.student_id !== studentId) {
		return null;
	}
	const sub = data.subjects as { name: string } | { name: string }[] | null;
	const subjectName = (Array.isArray(sub) ? sub[0]?.name : sub?.name)?.trim() || null;
	const top = data.topics as
		| { topic_name: string; chapter_name: string | null }
		| { topic_name: string; chapter_name: string | null }[]
		| null;
	const topicRow = Array.isArray(top) ? top[0] : top;

	let topicName = topicRow?.topic_name?.trim() || null;
	let chapterName = topicRow?.chapter_name?.trim() || null;
	if (!data.topic_id) {
		topicName = null;
		const meta = parseStoredChapterMeta(data.metadata);
		chapterName = meta?.chapter.chapter_name ?? chapterName;
	}

	return {
		id: data.id,
		studentId: data.student_id,
		subjectId: data.subject_id,
		topicId: data.topic_id ?? null,
		title: data.title,
		subjectName,
		topicName,
		chapterName,
	};
}

/**
 * UIMessage[] for `useChat` `messages` when resuming a thread.
 */
export async function loadDoubtTokenSummaryForConversation(conversationId: string): Promise<{
	totalPromptTokens: number;
	totalCompletionTokens: number;
	lastPromptTokens: number | null;
	lastCompletionTokens: number | null;
}> {
	const supabase = await createClient();
	const { data: rows, error } = await supabase
		.from("doubt_messages")
		.select("role, prompt_tokens, completion_tokens")
		.eq("conversation_id", conversationId)
		.order("created_at", { ascending: true });
	if (error) {
		logSupabaseError("loadDoubtTokenSummaryForConversation", error, { conversationId });
		return { totalPromptTokens: 0, totalCompletionTokens: 0, lastPromptTokens: null, lastCompletionTokens: null };
	}
	let totalP = 0;
	let totalC = 0;
	let lastP: number | null = null;
	let lastC: number | null = null;
	for (const r of rows ?? []) {
		if (r.role === "assistant" && r.prompt_tokens != null) {
			lastP = r.prompt_tokens;
			lastC = r.completion_tokens ?? 0;
			totalP += r.prompt_tokens;
			totalC += r.completion_tokens ?? 0;
		}
	}
	return {
		totalPromptTokens: totalP,
		totalCompletionTokens: totalC,
		lastPromptTokens: lastP,
		lastCompletionTokens: lastC,
	};
}

/**
 * Tutor mode from the latest user message that persisted `tutor_mode` (for rehydrating the mode selector).
 */
export async function loadLastDoubtTutorModeForConversation(
	conversationId: string,
): Promise<DoubtTutorMode | null> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("doubt_messages")
		.select("tutor_mode")
		.eq("conversation_id", conversationId)
		.eq("role", "user")
		.or("is_hidden.is.null,is_hidden.eq.false")
		.not("tutor_mode", "is", null)
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) {
		if (isPostgresUndefinedColumnError(error)) {
			return null;
		}
		logSupabaseError("loadLastDoubtTutorModeForConversation", error, { conversationId });
		return null;
	}
	const raw = data?.tutor_mode;
	if (typeof raw !== "string" || !isDoubtTutorMode(raw)) {
		return null;
	}
	return raw;
}

/**
 * Loads doubt-chat messages for a conversation as `UIMessage[]`.
 *
 * `opts.limit` (turns) — when set, returns at most `limit * 2` of the most
 * recent messages, in chronological order. Used by the route handler to cap
 * the context sent to OpenAI; full history is still returned when `limit` is
 * `opts.includeHiddenForModel` — when true (API route model history), include rows with
 * `is_hidden = true` (bootstrap scope). Default false for UI / parents / exports that use full history.
 */
export async function loadDoubtMessagesForConversationWithClient(
	supabase: SupabaseClient,
	conversationId: string,
	opts?: { limit?: number; includeHiddenForModel?: boolean },
): Promise<UIMessage[]> {
	const turnLimit = opts?.limit;
	const messageCap = typeof turnLimit === "number" && turnLimit > 0 ? turnLimit * 2 : null;

	let baseQuery = supabase
		.from("doubt_messages")
		.select("id, role, content, created_at")
		.eq("conversation_id", conversationId)
		.in("role", ["user", "assistant"]);

	if (!opts?.includeHiddenForModel) {
		baseQuery = baseQuery.or("is_hidden.is.null,is_hidden.eq.false");
	}

	const { data, error } =
		messageCap == null
			? await baseQuery.order("created_at", { ascending: true })
			: await baseQuery.order("created_at", { ascending: false }).limit(messageCap);

	if (error) {
		logSupabaseError("loadDoubtMessagesForConversationWithClient", error, { conversationId });
		return [];
	}
	const rows = data ?? [];
	const ordered = messageCap == null ? rows : [...rows].reverse();
	return ordered.map((r) => {
		const role = r.role as "user" | "assistant";
		return {
			id: r.id,
			role,
			parts: [
				{
					type: "text" as const,
					text: r.content,
					state: "done" as const,
				},
			],
		} satisfies UIMessage;
	});
}

export async function loadDoubtMessagesForConversation(conversationId: string): Promise<UIMessage[]> {
	const supabase = await createClient();
	return loadDoubtMessagesForConversationWithClient(supabase, conversationId);
}

export type DoubtMessageAttachmentsByMessageId = Record<string, AttachmentRow[]>;

/**
 * Attachment chips rendered above each user message in the chat window.
 */
export async function loadDoubtMessageAttachmentsByMessageId(
	conversationId: string,
): Promise<DoubtMessageAttachmentsByMessageId> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("doubt_message_attachments")
		.select("id, conversation_id, message_id, kind, storage_path, mime, size_bytes, ocr_text, created_at")
		.eq("conversation_id", conversationId)
		.order("created_at", { ascending: true });

	if (error || !data) {
		if (error) {
			logSupabaseError("loadDoubtMessageAttachmentsByMessageId", error, { conversationId });
		}
		return {};
	}

	const out: DoubtMessageAttachmentsByMessageId = {};
	for (const row of data) {
		const messageId = (row.message_id ?? null) as string | null;
		if (!messageId) continue;
		const attachment: AttachmentRow = {
			id: row.id as string,
			conversationId: row.conversation_id as string,
			messageId,
			kind: row.kind as "image" | "pdf",
			storagePath: row.storage_path as string,
			mime: row.mime as string,
			sizeBytes: row.size_bytes as number,
			ocrText: (row.ocr_text ?? null) as string | null,
			createdAt: row.created_at as string,
		};
		out[messageId] = [...(out[messageId] ?? []), attachment];
	}
	return out;
}
