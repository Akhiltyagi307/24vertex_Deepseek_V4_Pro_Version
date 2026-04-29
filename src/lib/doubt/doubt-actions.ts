"use server";

import { z } from "zod";

import { loadDoubtTopicRows, type DoubtChatTopicRow } from "@/lib/doubt/loaders";
import { validateDoubtScope } from "@/lib/doubt/validate-doubt-scope";
import { getOpenAIChatModel } from "@/lib/env";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { getStudentSubjectsRpc } from "@/lib/student/get-student-subjects-rpc";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
	subjectId: z.string().uuid(),
	topicId: z.string().uuid(),
});

export type CreateDoubtConversationResult =
	| { ok: true; conversationId: string; title: string }
	| { ok: false; code: string; message: string };

/**
 * Inserts a doubt_conversations row (topic-scoped) before the first streamed message.
 */
export async function createDoubtConversation(input: unknown): Promise<CreateDoubtConversationResult> {
	const parsed = createSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, code: "validation_error", message: "Check your subject and topic selection." };
	}

	const supabase = await createClient();
	const scope = await validateDoubtScope(supabase, {
		subjectId: parsed.data.subjectId,
		topicId: parsed.data.topicId,
	});
	if (!scope.ok) {
		return { ok: false, code: scope.code, message: scope.message };
	}

	const title = `${scope.topic.topicName} — ${scope.subjectName}`;
	const model = getOpenAIChatModel();

	const { data: created, error } = await supabase
		.from("doubt_conversations")
		.insert({
			student_id: scope.userId,
			subject_id: scope.subjectId,
			topic_id: scope.topic.id,
			title,
			model,
			metadata: {},
		})
		.select("id")
		.single();

	if (error || !created?.id) {
		if (error) {
			logSupabaseError("createDoubtConversation.insert", error, { userId: scope.userId });
		}
		return { ok: false, code: "database_error", message: "Could not start a new chat. Try again." };
	}

	return { ok: true, conversationId: created.id, title };
}

const topicListSchema = z.object({
	subjectId: z.string().uuid(),
});

export type LoadTopicsForDoubtResult =
	| { ok: true; topics: DoubtChatTopicRow[] }
	| { ok: false; code: string; message: string };

/**
 * Fetches curriculum topics for the enrolled subject and the signed-in student's grade.
 */
export async function getDoubtTopicsForSubjectAction(input: unknown): Promise<LoadTopicsForDoubtResult> {
	const parsed = topicListSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, code: "validation_error", message: "Invalid subject." };
	}
	const supabase = await createClient();
	const {
		data: { user: authUser },
	} = await supabase.auth.getUser();
	if (!authUser) {
		return { ok: false, code: "unauthorized", message: "Sign in to continue." };
	}
	const { data: profileRow, error: profileErr } = await supabase
		.from("profiles")
		.select("grade, stream, elective_subject_id, role")
		.eq("id", authUser.id)
		.maybeSingle();

	if (profileErr || !profileRow || profileRow.role !== "student" || profileRow.grade == null) {
		return { ok: false, code: "not_student", message: "This action is only for students with a complete profile." };
	}

	const { data: subjectRpcRows, error: rpcErr } = await getStudentSubjectsRpc<{ id: string }>(supabase, {
		p_grade: profileRow.grade,
		p_stream: profileRow.stream,
		p_elective_id: profileRow.elective_subject_id,
	});

	if (rpcErr) {
		return { ok: false, code: "database_error", message: "Could not verify enrollment." };
	}

	const enrolled = new Set(
		((subjectRpcRows ?? []) as { id: string }[]).map((r) => r.id).filter(Boolean),
	);
	if (!enrolled.has(parsed.data.subjectId)) {
		return { ok: false, code: "not_enrolled", message: "That subject is not in your enrollment." };
	}

	const topics = await loadDoubtTopicRows(parsed.data.subjectId, profileRow);
	return { ok: true, topics };
}

const usageSchema = z.object({ conversationId: z.string().uuid() });

export type DoubtUsageSummary = {
	totalPromptTokens: number;
	totalCompletionTokens: number;
	lastPromptTokens: number | null;
	lastCompletionTokens: number | null;
};

/**
 * Sums and last-turn token usage for the doubt chat (assistant messages only; DB stores usage on those rows).
 */
export async function getDoubtUsageSummaryAction(
	input: unknown,
): Promise<{ ok: true; summary: DoubtUsageSummary } | { ok: false; message: string }> {
	const parsed = usageSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, message: "Invalid conversation." };
	}
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return { ok: false, message: "Sign in to continue." };
	}
	const { data: conv, error: cErr } = await supabase
		.from("doubt_conversations")
		.select("id")
		.eq("id", parsed.data.conversationId)
		.eq("student_id", user.id)
		.maybeSingle();
	if (cErr || !conv) {
		return { ok: false, message: "Conversation not found." };
	}
	const { data: rows, error: mErr } = await supabase
		.from("doubt_messages")
		.select("role, prompt_tokens, completion_tokens")
		.eq("conversation_id", parsed.data.conversationId)
		.order("created_at", { ascending: true });
	if (mErr) {
		return { ok: false, message: "Could not load usage." };
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
		ok: true,
		summary: {
			totalPromptTokens: totalP,
			totalCompletionTokens: totalC,
			lastPromptTokens: lastP,
			lastCompletionTokens: lastC,
		},
	};
}

const deleteConversationSchema = z.object({
	conversationId: z.string().uuid(),
});

export type DeleteDoubtConversationResult =
	| { ok: true }
	| { ok: false; message: string };

/**
 * Deletes a doubt thread and all messages (CASCADE from doubt_messages).
 * RLS allows only the owning student to delete.
 */
export async function deleteDoubtConversationAction(
	input: unknown,
): Promise<DeleteDoubtConversationResult> {
	const parsed = deleteConversationSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, message: "Invalid conversation." };
	}
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return { ok: false, message: "Sign in to continue." };
	}
	const { data, error } = await supabase
		.from("doubt_conversations")
		.delete()
		.eq("id", parsed.data.conversationId)
		.eq("student_id", user.id)
		.select("id")
		.maybeSingle();

	if (error) {
		logSupabaseError("deleteDoubtConversationAction.delete", error, {
			userId: user.id,
			conversationId: parsed.data.conversationId,
		});
		return { ok: false, message: "Could not delete chat. Try again." };
	}
	if (!data) {
		return { ok: false, message: "Chat not found or you may not have access." };
	}
	return { ok: true };
}
