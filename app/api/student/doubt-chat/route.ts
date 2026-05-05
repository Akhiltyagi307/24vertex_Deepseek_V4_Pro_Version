import { convertToModelMessages, type UIMessage, streamText } from "ai";

import { getDoubtModeTemplate, interpolateDoubtPromptTemplate } from "@/lib/ai/doubt-prompt-templates";
import { getOpenAIProvider } from "@/lib/ai/openai-provider";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import { getActiveAiPrompt } from "@/lib/ai/prompt-store";
import { doubtChatBodySchema } from "@/lib/doubt/request-schema";
import { getTextFromUIMessage } from "@/lib/doubt/uimessage-text";
import { validateDoubtScope } from "@/lib/doubt/validate-doubt-scope";
import { getOpenAIChatModel } from "@/lib/env";
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
import { recordPracticeEvent } from "@/lib/practice/analytics";
import { loadDoubtMessagesForConversationWithClient } from "@/lib/doubt/loaders";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

function toUIMessageList(raw: unknown[]): UIMessage[] {
	return raw as UIMessage[];
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
	// Reconciled in onFinish below.
	await consumeTokens(supabase, user.id, DOUBT_CHAT_PRE_DEBIT_TOKENS);

	const scope = await validateDoubtScope(supabase, { subjectId, topicId });
	if (!scope.ok) {
		const status = scope.code === "unauthorized" ? 401 : 400;
		return new Response(JSON.stringify({ error: scope.message, code: scope.code }), {
			status,
			headers: { "content-type": "application/json" },
		});
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

	const modelId = getOpenAIChatModel();
	const doubtFeature = tutorMode === "explain" ? "doubt.explain" : "doubt.solve_with_me";
	const dbPrompt = await getActiveAiPrompt(doubtFeature);
	const templateSrc = dbPrompt?.template?.trim()
		? dbPrompt.template
		: getDoubtModeTemplate(tutorMode);
	const system = interpolateDoubtPromptTemplate(templateSrc, scope);

	const { data: existing, error: findErr } = await supabase
		.from("doubt_conversations")
		.select("id, student_id, subject_id, topic_id")
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
	if (existing.subject_id !== subjectId || existing.topic_id !== topicId) {
		return new Response(JSON.stringify({ error: "Subject or topic no longer matches this chat." }), {
			status: 400,
			headers: { "content-type": "application/json" },
		});
	}
	const conversationId = existing.id;

	const userMessageBase = {
		conversation_id: conversationId,
		role: "user" as const,
		content: lastUserText,
		prompt_tokens: null,
		completion_tokens: null,
		model: null,
	};
	let { error: userMsgErr } = await supabase
		.from("doubt_messages")
		.insert({ ...userMessageBase, tutor_mode: tutorMode });
	if (userMsgErr && isPostgresUndefinedColumnError(userMsgErr)) {
		({ error: userMsgErr } = await supabase.from("doubt_messages").insert(userMessageBase));
	}
	if (userMsgErr) {
		logSupabaseError("doubt_chat.insert_user_message", userMsgErr, { conversationId });
		return new Response(JSON.stringify({ error: "Could not save your message." }), {
			status: 500,
			headers: { "content-type": "application/json" },
		});
	}

	const threadFromDb = await loadDoubtMessagesForConversationWithClient(supabase, conversationId);
	const forModel = threadFromDb.map((m) => {
		const { id: _i, ...rest } = m;
		return rest;
	}) as UIMessage[];

	let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
	try {
		modelMessages = await convertToModelMessages(forModel);
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
			const billableTurn = finishReason === "stop" || finishReason === "length";
			const { error: asstErr } = await supabase.from("doubt_messages").insert({
				conversation_id: conversationId,
				role: "assistant",
				content: text,
				prompt_tokens: promptT,
				completion_tokens: compT,
				model: modelId,
			});
			if (asstErr) {
				logSupabaseError("doubt_chat.insert_assistant", asstErr, { conversationId });
			}
			const { error: updErr } = await supabase
				.from("doubt_conversations")
				.update({ updated_at: new Date().toISOString(), model: modelId })
				.eq("id", conversationId);
			if (updErr) {
				logSupabaseError("doubt_chat.touch_conversation", updErr, { conversationId });
			}
			// Reconcile against the pre-debit. If actual output exceeded the
			// reservation, top up the difference. If it was lower, keep the small
			// over-debit (we don't refund — keeps the gate strict against
			// short-turn flooding and the magnitude is bounded by the constant).
			const outputTokens = compT ?? 0;
			if (billableTurn && !asstErr && outputTokens > DOUBT_CHAT_PRE_DEBIT_TOKENS) {
				await consumeTokens(supabase, user.id, outputTokens - DOUBT_CHAT_PRE_DEBIT_TOKENS);
			}
		},
	});

	return result.toUIMessageStreamResponse({ headers });
}
