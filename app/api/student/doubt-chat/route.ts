import { convertToModelMessages, type UIMessage, streamText } from "ai";

import { getDoubtModeTemplate, interpolateDoubtPromptTemplate } from "@/lib/ai/doubt-prompt-templates";
import { getOpenAIProvider } from "@/lib/ai/openai-provider";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import { getActiveAiPrompt } from "@/lib/ai/prompt-store";
import {
	bindAttachmentsToMessage,
	decorateThreadMessagesWithBoundAttachments,
	loadAttachmentsForRequest,
} from "@/lib/doubt/attachments/build-model-parts";
import { fetchDoubtTopicContextBlockByTopicIds } from "@/lib/doubt/topic-context-chunks";
import { doubtChatBodySchema } from "@/lib/doubt/request-schema";
import { getTextFromUIMessage } from "@/lib/doubt/uimessage-text";
import { resolveDoubtScopeForConversation, type DoubtScopeSuccess } from "@/lib/doubt/validate-doubt-scope";
import { getOpenAIDoubtChatModel } from "@/lib/env";
import { isPostgresUndefinedColumnError, logSupabaseError } from "@/lib/server/log-supabase-error";
import { consumeDoubtChatRateLimit } from "@/lib/practice/practice-rate-limit";
import { canStartDoubtChat, consumeTokens } from "@/lib/billing/entitlements";

/**
 * Conservative reservation debited at the gate so concurrent turns can't bypass
 * the tokens-left check. Reconciled in onFinish: a normal-length turn debits the
 * delta on top; a short turn keeps the small over-debit. ~150 output tokens is
 * roughly 0.3% of a typical period budget — small enough that the friction is
 * acceptable, large enough that 5 simultaneous turns can't all sneak past.
 */
const DOUBT_CHAT_PRE_DEBIT_TOKENS = 150;

/**
 * Sliding-window cap for messages sent to OpenAI per turn. The topic context
 * (subject / chapter / topic / learning objectives) lives in the system prompt,
 * so older turns are safe to drop. 10 turns = 20 messages keeps input tokens
 * bounded at ~3-5K worst-case regardless of conversation length.
 */
const DOUBT_CHAT_HISTORY_TURN_CAP = 10;
import { recordPracticeEvent } from "@/lib/practice/analytics";
import { loadDoubtMessagesForConversationWithClient } from "@/lib/doubt/loaders";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const maxDuration = 120;

function toUIMessageList(raw: unknown[]): UIMessage[] {
	return raw as UIMessage[];
}

function attachTopicContextChunksToScope(scope: DoubtScopeSuccess, chunkBlock: string): DoubtScopeSuccess {
	if (scope.kind === "topic") {
		return {
			...scope,
			topic: {
				...scope.topic,
				contextChunksBlock: chunkBlock,
			},
		};
	}
	return {
		...scope,
		chapter: {
			...scope.chapter,
			contextChunksBlock: chunkBlock,
		},
	};
}

export async function POST(req: Request) {
	const json = await req.json().catch(() => null);
	const parsed = doubtChatBodySchema.safeParse(json);
	if (!parsed.success) {
		return new Response(
			JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
			{ status: 400, headers: { "content-type": "application/json" } },
		);
	}

	const {
		messages: rawMessages,
		subjectId,
		topicId,
		conversationId: rawConvId,
		tutorMode,
		attachmentIds,
	} = parsed.data;
	const messages = toUIMessageList(rawMessages);
	const headers = new Headers();
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "content-type": "application/json" },
		});
	}

	const rate = await consumeDoubtChatRateLimit(supabase);
	if (!rate.ok) {
		return new Response(JSON.stringify({ error: rate.message }), {
			status: 429,
			headers: { "content-type": "application/json" },
		});
	}

	const billingGate = await canStartDoubtChat(supabase, user.id);
	if (!billingGate.ok) {
		void recordPracticeEvent(
			supabase,
			"paywall_shown",
			{ surface: "doubt_chat", reason: billingGate.code },
			{ studentId: user.id },
		);
		return new Response(
			JSON.stringify({ error: billingGate.message, code: billingGate.code, paywall: true }),
			{ status: 402, headers: { "content-type": "application/json" } },
		);
	}

	// Reserve a conservative chunk of tokens BEFORE we start streaming so
	// concurrent turns observed before any onFinish runs cannot all pass the
	// canStartDoubtChat gate while having only one turn's worth of quota left.
	// Reconciled in onFinish below. Vision turns reserve a bit more because
	// image tokens are denser per pixel than plain text.
	const hasAttachments = attachmentIds.length > 0;
	const preDebit = hasAttachments
		? Math.round(DOUBT_CHAT_PRE_DEBIT_TOKENS * 1.7)
		: DOUBT_CHAT_PRE_DEBIT_TOKENS;
	await consumeTokens(supabase, user.id, preDebit);

	const { data: existing, error: findErr } = await supabase
		.from("doubt_conversations")
		.select("id, student_id, subject_id, topic_id, metadata")
		.eq("id", rawConvId)
		.maybeSingle();
	if (findErr) {
		logSupabaseError("doubt_chat.find_conversation", findErr, { conversationId: rawConvId });
		return new Response(JSON.stringify({ error: "Could not open this conversation." }), {
			status: 500,
			headers: { "content-type": "application/json" },
		});
	}
	if (!existing || existing.student_id !== user.id) {
		return new Response(JSON.stringify({ error: "Conversation not found." }), {
			status: 404,
			headers: { "content-type": "application/json" },
		});
	}
	if (existing.subject_id !== subjectId) {
		return new Response(JSON.stringify({ error: "Subject no longer matches this chat." }), {
			status: 400,
			headers: { "content-type": "application/json" },
		});
	}
	const storedTopicId = existing.topic_id ?? null;
	const bodyTopicId = topicId ?? null;
	if (storedTopicId !== bodyTopicId) {
		return new Response(JSON.stringify({ error: "Topic scope no longer matches this chat." }), {
			status: 400,
			headers: { "content-type": "application/json" },
		});
	}

	const scope = await resolveDoubtScopeForConversation(supabase, {
		subjectId: existing.subject_id,
		topicId: storedTopicId,
		metadata: existing.metadata,
	});
	if (!scope.ok) {
		const status = scope.code === "unauthorized" ? 401 : 400;
		return new Response(JSON.stringify({ error: scope.message, code: scope.code }), {
			status,
			headers: { "content-type": "application/json" },
		});
	}

	let groundedScope: DoubtScopeSuccess;
	try {
		const topicIds = scope.kind === "topic" ? [scope.topic.id] : scope.chapter.topicIds;
		const chunksRes = await fetchDoubtTopicContextBlockByTopicIds(createServiceRoleClient(), topicIds);
		if (!chunksRes.ok) {
			return new Response(
				JSON.stringify({
					error: chunksRes.message,
					code: chunksRes.code,
				}),
				{ status: 400, headers: { "content-type": "application/json" } },
			);
		}
		groundedScope = attachTopicContextChunksToScope(scope, chunksRes.block);
	} catch (e) {
		logSupabaseError(
			"doubt_chat.context_chunks",
			{ message: e instanceof Error ? e.message : String(e) },
			{ conversationId: existing.id },
		);
		return new Response(
			JSON.stringify({
				error: "Could not load chapter context right now. Please try again.",
				code: "context_chunks_unavailable",
			}),
			{ status: 500, headers: { "content-type": "application/json" } },
		);
	}

	const last = messages.filter((m) => m.role === "user").at(-1);
	if (!last) {
		return new Response(JSON.stringify({ error: "Last message must be from the user." }), {
			status: 400,
			headers: { "content-type": "application/json" },
		});
	}
	const lastUserText = getTextFromUIMessage(last).trim();
	if (!lastUserText) {
		return new Response(JSON.stringify({ error: "Message text is empty." }), {
			status: 400,
			headers: { "content-type": "application/json" },
		});
	}

	const modelId = getOpenAIDoubtChatModel();
	const doubtFeature = tutorMode === "explain" ? "doubt.explain" : "doubt.solve_with_me";
	const dbPrompt = await getActiveAiPrompt(doubtFeature);
	const templateSrc = dbPrompt?.template?.trim()
		? dbPrompt.template
		: getDoubtModeTemplate(tutorMode);
	const system = interpolateDoubtPromptTemplate(templateSrc, groundedScope);

	const conversationId = existing.id as string;

	// Validate attachment ownership (must belong to this conversation, which
	// we've already verified belongs to the user).
	const attachments = await loadAttachmentsForRequest(supabase, conversationId, attachmentIds);
	if (attachments.length !== attachmentIds.length) {
		return new Response(
			JSON.stringify({ error: "One or more attachments could not be found." }),
			{ status: 400, headers: { "content-type": "application/json" } },
		);
	}

	const userMessageBase = {
		conversation_id: conversationId,
		role: "user" as const,
		content: lastUserText,
		prompt_tokens: null,
		completion_tokens: null,
		model: null,
	};
	let userInsert = await supabase
		.from("doubt_messages")
		.insert({ ...userMessageBase, tutor_mode: tutorMode })
		.select("id")
		.maybeSingle();
	if (userInsert.error && isPostgresUndefinedColumnError(userInsert.error)) {
		userInsert = await supabase
			.from("doubt_messages")
			.insert(userMessageBase)
			.select("id")
			.maybeSingle();
	}
	if (userInsert.error || !userInsert.data?.id) {
		logSupabaseError("doubt_chat.insert_user_message", userInsert.error ?? { message: "no id" }, {
			conversationId,
		});
		return new Response(JSON.stringify({ error: "Could not save your message." }), {
			status: 500,
			headers: { "content-type": "application/json" },
		});
	}
	const userMessageId = userInsert.data.id as string;

	// Bind freshly-uploaded attachments to the just-saved user message.
	if (attachmentIds.length > 0) {
		try {
			await bindAttachmentsToMessage(supabase, attachmentIds, userMessageId);
		} catch (e) {
			logSupabaseError(
				"doubt_chat.bind_attachments",
				{ message: e instanceof Error ? e.message : String(e) },
				{ conversationId, userMessageId },
			);
		}
	}

	const threadFromDb = await loadDoubtMessagesForConversationWithClient(supabase, conversationId, {
		limit: DOUBT_CHAT_HISTORY_TURN_CAP,
		includeHiddenForModel: false,
	});

	// Include attachments bound to user messages across the recent history
	// window so follow-up questions can still use previously uploaded files.
	const forModelWithAttachments = await decorateThreadMessagesWithBoundAttachments(
		supabase,
		conversationId,
		threadFromDb,
	);

	let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
	try {
		modelMessages = await convertToModelMessages(forModelWithAttachments);
	} catch (e) {
		const message = e instanceof Error ? e.message : "Invalid message format.";
		return new Response(JSON.stringify({ error: message }), {
			status: 400,
			headers: { "content-type": "application/json" },
		});
	}

	const streamStartedAt = Date.now();
	const result = streamText({
		model: getOpenAIProvider().chat(modelId),
		system,
		messages: modelMessages,
		// Cancel the OpenAI HTTP call when the client disconnects so we stop
		// paying for tokens after the user closes the tab.
		abortSignal: req.signal,
		onFinish: async ({ text, totalUsage, finishReason }) => {
			const promptT = totalUsage?.inputTokens ?? null;
			const compT = totalUsage?.outputTokens ?? null;
			// Telemetry runs unconditionally — we want visibility on aborts/errors too.
			void recordAiCall({
				feature: "doubt.chat",
				model: modelId,
				userId: user.id,
				promptId: dbPrompt?.id ?? null,
				inputTokens: promptT ?? 0,
				outputTokens: compT ?? 0,
				latencyMs: Date.now() - streamStartedAt,
				status: "ok",
			});
			// Bill only normal completions (not provider errors, aborts, or tool loops).
			// Aborted/errored streams skip persistence entirely so the sidebar doesn't
			// reorder for half-baked answers.
			const billableTurn = finishReason === "stop" || finishReason === "length";
			let asstErr: { message: string } | null = null;
			if (billableTurn) {
				// Run the two independent writes in parallel — saves 150–300ms per turn.
				const [insertResult, updateResult] = await Promise.allSettled([
					supabase.from("doubt_messages").insert({
						conversation_id: conversationId,
						role: "assistant",
						content: text,
						prompt_tokens: promptT,
						completion_tokens: compT,
						model: modelId,
					}),
					supabase
						.from("doubt_conversations")
						.update({ updated_at: new Date().toISOString(), model: modelId })
						.eq("id", conversationId),
				]);
				if (insertResult.status === "fulfilled" && insertResult.value.error) {
					logSupabaseError("doubt_chat.insert_assistant", insertResult.value.error, { conversationId });
					asstErr = { message: insertResult.value.error.message ?? "insert failed" };
				} else if (insertResult.status === "rejected") {
					logSupabaseError(
						"doubt_chat.insert_assistant",
						{ message: String(insertResult.reason) },
						{ conversationId },
					);
					asstErr = { message: String(insertResult.reason) };
				}
				if (updateResult.status === "fulfilled" && updateResult.value.error) {
					logSupabaseError("doubt_chat.touch_conversation", updateResult.value.error, { conversationId });
				} else if (updateResult.status === "rejected") {
					logSupabaseError(
						"doubt_chat.touch_conversation",
						{ message: String(updateResult.reason) },
						{ conversationId },
					);
				}
				// Reconcile against the pre-debit. If actual output exceeded the
				// reservation, top up the difference. If it was lower, keep the small
				// over-debit (we don't refund — keeps the gate strict against
				// short-turn flooding and the magnitude is bounded by the constant).
				const outputTokens = compT ?? 0;
				if (!asstErr && outputTokens > preDebit) {
					await consumeTokens(supabase, user.id, outputTokens - preDebit);
				}
			}
		},
	});

	return result.toUIMessageStreamResponse({ headers });
}
