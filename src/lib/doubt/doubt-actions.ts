"use server";

import { z } from "zod";

import { loadDoubtTopicRows, type DoubtChatEntitlement, type DoubtChatTopicRow } from "@/lib/doubt/loaders";
import { validateDoubtScope } from "@/lib/doubt/validate-doubt-scope";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getOpenAIDoubtChatModel } from "@/lib/env";
import {
	consumeDoubtChatRateLimit,
	consumeDoubtChatReadRateLimit,
} from "@/lib/practice/practice-rate-limit";
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
	const rate = await consumeDoubtChatRateLimit(supabase);
	if (!rate.ok) {
		return { ok: false, code: "rate_limited", message: rate.message };
	}
	const scope = await validateDoubtScope(supabase, {
		subjectId: parsed.data.subjectId,
		topicId: parsed.data.topicId,
	});
	if (!scope.ok) {
		return { ok: false, code: scope.code, message: scope.message };
	}

	const title = `${scope.topic.topicName} — ${scope.subjectName}`;
	const model = getOpenAIDoubtChatModel();

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
	const rate = await consumeDoubtChatRateLimit(supabase);
	if (!rate.ok) {
		return { ok: false, code: "rate_limited", message: rate.message };
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
	const rate = await consumeDoubtChatReadRateLimit(supabase);
	if (!rate.ok) {
		return { ok: false, message: rate.message };
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
 *
 * Also cleans up the associated objects in the `doubt-attachments` Storage
 * bucket. The DB row CASCADE handles `doubt_message_attachments`, but storage
 * objects don't FK back to the row — without this step, files leak in storage.
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
	// Snapshot storage paths BEFORE the delete — RLS lets the owner read these
	// rows, and the next CASCADE will remove them.
	const { data: attachmentRows } = await supabase
		.from("doubt_message_attachments")
		.select("storage_path")
		.eq("conversation_id", parsed.data.conversationId);
	const storagePaths = (attachmentRows ?? [])
		.map((r) => r.storage_path as string | null)
		.filter((p): p is string => Boolean(p));

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
	// Best-effort storage cleanup — owner RLS lets them remove their own
	// objects. Failure here is logged but does not surface to the user; the DB
	// row is already gone, the orphan is at most a few KB-MB until the next
	// erasure or admin sweep.
	if (storagePaths.length > 0) {
		const { error: storageErr } = await supabase.storage
			.from("doubt-attachments")
			.remove(storagePaths);
		if (storageErr) {
			logSupabaseError(
				"deleteDoubtConversationAction.storage_cleanup",
				{ message: storageErr.message },
				{ userId: user.id, conversationId: parsed.data.conversationId, count: storagePaths.length },
			);
		}
	}
	return { ok: true };
}

export type GetDoubtEntitlementResult =
	| { ok: true; entitlement: DoubtChatEntitlement }
	| { ok: false; message: string };

/**
 * Fresh entitlement snapshot for the doubt-chat composer's quota meter. Called
 * after each turn finishes so the meter reflects newly-billed tokens without a
 * full page refresh. Uses the dedicated read-side bucket so a per-turn refresh
 * doesn't eat the user's chat-send budget.
 */
export async function getDoubtEntitlementSummaryAction(): Promise<GetDoubtEntitlementResult> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return { ok: false, message: "Sign in to continue." };
	}
	const rate = await consumeDoubtChatReadRateLimit(supabase);
	if (!rate.ok) {
		return { ok: false, message: rate.message };
	}
	const snapshot = await getEntitlements(supabase, user.id);
	if (!snapshot) {
		return {
			ok: true,
			entitlement: { tokensUsed: 0, tokensQuota: 0, tokensLeft: 0 },
		};
	}
	return {
		ok: true,
		entitlement: {
			tokensUsed: snapshot.tokensUsed,
			tokensQuota: snapshot.tokensQuota,
			tokensLeft: snapshot.tokensLeft,
		},
	};
}

const regenerateSchema = z.object({
	conversationId: z.string().uuid(),
});

export type RegenerateLastAssistantResult =
	| { ok: true }
	| { ok: false; code: string; message: string };

/**
 * Deletes the most recent assistant message in a doubt-chat conversation so
 * the client can call `useChat`'s `regenerate()` (or re-`sendMessage`) and
 * receive a fresh stream for the same user prompt. Useful when an earlier
 * stream aborted, errored, or simply produced an unhelpful answer.
 *
 * RLS-secured: the caller must own the conversation. We re-check ownership
 * here in addition to the DB-level policy because the action runs over a
 * cookie-scoped client and we want a clear `{ ok: false }` payload for the
 * UI rather than a Supabase error string.
 */
export async function regenerateLastAssistantAction(
	input: unknown,
): Promise<RegenerateLastAssistantResult> {
	const parsed = regenerateSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, code: "validation_error", message: "Invalid conversation." };
	}
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return { ok: false, code: "unauthorized", message: "Sign in to continue." };
	}
	const rate = await consumeDoubtChatRateLimit(supabase);
	if (!rate.ok) {
		return { ok: false, code: "rate_limited", message: rate.message };
	}
	// Verify ownership explicitly — RLS would also block, but we want a stable
	// 4xx-style code in the response shape.
	const { data: conv, error: cErr } = await supabase
		.from("doubt_conversations")
		.select("id, student_id")
		.eq("id", parsed.data.conversationId)
		.maybeSingle();
	if (cErr) {
		logSupabaseError("regenerateLastAssistantAction.find", cErr, {
			conversationId: parsed.data.conversationId,
		});
		return { ok: false, code: "database_error", message: "Could not load conversation." };
	}
	if (!conv || conv.student_id !== user.id) {
		return { ok: false, code: "not_found", message: "Chat not found." };
	}
	const { data: lastAssistant, error: findErr } = await supabase
		.from("doubt_messages")
		.select("id")
		.eq("conversation_id", parsed.data.conversationId)
		.eq("role", "assistant")
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();
	if (findErr) {
		logSupabaseError("regenerateLastAssistantAction.findLast", findErr, {
			conversationId: parsed.data.conversationId,
		});
		return { ok: false, code: "database_error", message: "Could not find the last reply." };
	}
	if (!lastAssistant) {
		// No assistant row to delete (e.g. previous turn errored before insert).
		// The client is still safe to re-send.
		return { ok: true };
	}
	const { error: delErr } = await supabase
		.from("doubt_messages")
		.delete()
		.eq("id", lastAssistant.id);
	if (delErr) {
		logSupabaseError("regenerateLastAssistantAction.delete", delErr, {
			conversationId: parsed.data.conversationId,
			messageId: lastAssistant.id,
		});
		return { ok: false, code: "database_error", message: "Could not regenerate." };
	}
	return { ok: true };
}
