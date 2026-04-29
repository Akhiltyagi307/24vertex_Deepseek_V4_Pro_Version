import "server-only";

import type { UIMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { loadStudentSubjects, type StudentSubjectsProfileRow } from "@/lib/student/load-student-subjects";

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

	return {
		ok: true as const,
		profile: profileRow,
		subjects: subj.subjects,
		subjectsLoadError: subj.loadError,
		conversations,
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
	topicId: string;
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
			"id, student_id, subject_id, topic_id, title, subjects(name), topics(topic_name, chapter_name)",
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
	return {
		id: data.id,
		studentId: data.student_id,
		subjectId: data.subject_id,
		topicId: data.topic_id,
		title: data.title,
		subjectName,
		topicName: topicRow?.topic_name?.trim() || null,
		chapterName: topicRow?.chapter_name?.trim() || null,
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

export async function loadDoubtMessagesForConversationWithClient(
	supabase: SupabaseClient,
	conversationId: string,
): Promise<UIMessage[]> {
	const { data, error } = await supabase
		.from("doubt_messages")
		.select("id, role, content, created_at")
		.eq("conversation_id", conversationId)
		.in("role", ["user", "assistant"])
		.order("created_at", { ascending: true });
	if (error) {
		logSupabaseError("loadDoubtMessagesForConversationWithClient", error, { conversationId });
		return [];
	}
	return (data ?? []).map((r) => {
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
