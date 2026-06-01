import { convertToModelMessages, type UIMessage } from "ai";
import * as Sentry from "@sentry/nextjs";

import type { DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";
import {
	extractDeepSeekCacheTokens,
	extractReasoningTokens,
} from "@/lib/ai/deepseek-provider";
import {
	getDoubtModeTemplateForScope,
	interpolateDoubtPromptTemplate,
} from "@/lib/ai/doubt-prompt-templates";
import { streamTextWithProviderFallback } from "@/lib/ai/provider-fallback";

/**
 * Map a tutor mode to the AI-prompts feature key. The DB-prompt store keys are
 * `doubt.<mode>` so admins can override each mode's template independently
 * without redeploying. Centralised here so a new mode added in
 * `DoubtTutorMode` is a TypeScript error until it gets a key.
 */
function doubtFeatureForMode(mode: DoubtTutorMode): string {
	switch (mode) {
		case "explain":
			return "doubt.explain";
		case "solve_with_me":
			return "doubt.solve_with_me";
		case "quiz_me":
			return "doubt.quiz_me";
	}
}
import { resolveChatModel } from "@/lib/ai/model-router";
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
import {
	buildScopeVocab,
	OFF_TOPIC_USER_MESSAGE,
	userTurnLikelyOutOfScope,
} from "@/lib/doubt/scope-precheck";
import {
	stripImagePartsFromMessages,
	stripReasoningPartsFromMessages,
} from "@/lib/doubt/strip-model-parts";
import {
	flagDoubtAttachmentInjection,
	flagDoubtImageForReview,
	flagDoubtSafety,
	screenDoubtInput,
	screenDoubtOutput,
	shouldSampleImageForReview,
} from "@/lib/doubt/safety";
import { ensureDoubtSafetyFloor, SAFE_OUTPUT_PLACEHOLDER } from "@/lib/doubt/safety-detectors";
import { isDoubtScopePrecheckEnabled } from "@/lib/env";
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
		previousTutorMode,
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
		const storedMistake =
			existing.metadata && typeof (existing.metadata as Record<string, unknown>).mistakeBlock === "string"
				? ((existing.metadata as Record<string, unknown>).mistakeBlock as string)
				: null;
		if (storedMistake) {
			groundedScope =
				groundedScope.kind === "topic"
					? { ...groundedScope, topic: { ...groundedScope.topic, mistakeBlock: storedMistake } }
					: { ...groundedScope, chapter: { ...groundedScope.chapter, mistakeBlock: storedMistake } };
		}
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

	// Deterministic safety screen (no LLM). Runs on every turn, independent of
	// the off-topic flag below. Hard content (slurs / sexual harassment / admin
	// blacklist) blocks the turn; distress and PII are flagged for human review
	// but never block — the model still answers, and its prompt routes severe
	// distress to crisis lines. The screen fails open internally, so a screening
	// fault can never wedge the chat. `redactedText` is the original text unless
	// PII redaction-at-rest is enabled (off by default).
	const inputScreen = await screenDoubtInput(lastUserText);
	if (inputScreen.block) {
		// Persist the audit trail BEFORE responding. On a serverless runtime the
		// function can freeze the instant we return the Response, so fire-and-forget
		// writes here can be dropped — and the blocked-turn flag is precisely the
		// record we must not lose. Both writes are internally fail-silent, so
		// allSettled just guarantees they finish without ever throwing.
		await Promise.allSettled([
			flagDoubtSafety({ conversationId: existing.id as string, categories: inputScreen.categories }),
			recordPracticeEvent(
				supabase,
				"doubt_chat_input_blocked",
				{
					sources: inputScreen.categories.map((c) => c.source),
					subject_id: subjectId,
					topic_id: topicId,
				},
				{ studentId: user.id },
			),
		]);
		return new Response(
			JSON.stringify({ error: inputScreen.blockMessage, code: "blocked_content" }),
			{ status: 422, headers: { "content-type": "application/json" } },
		);
	}
	if (inputScreen.sensitive) {
		// Review-only: the tutor still answers, we just flag the sensitive
		// curricular topic for visibility. Streaming keeps the function alive, so
		// fire-and-forget is safe on this path.
		void flagDoubtSafety({
			conversationId: existing.id as string,
			categories: inputScreen.categories.filter((c) => c.kind === "sensitive"),
		});
		void recordPracticeEvent(
			supabase,
			"doubt_chat_sensitive_flagged",
			{ subject_id: subjectId, topic_id: topicId },
			{ studentId: user.id },
		);
	}
	if (inputScreen.distress) {
		void flagDoubtSafety({
			conversationId: existing.id as string,
			categories: inputScreen.categories.filter((c) => c.kind === "distress"),
		});
		void recordPracticeEvent(
			supabase,
			"doubt_chat_distress_flagged",
			{ subject_id: subjectId, topic_id: topicId },
			{ studentId: user.id },
		);
	}
	if (inputScreen.pii) {
		void flagDoubtSafety({
			conversationId: existing.id as string,
			categories: inputScreen.categories.filter((c) => c.kind === "pii"),
		});
		void recordPracticeEvent(
			supabase,
			"doubt_chat_pii_detected",
			{ redacted: inputScreen.redactedText !== lastUserText },
			{ studentId: user.id },
		);
	}
	if (inputScreen.categories.some((c) => c.kind === "injection")) {
		void flagDoubtSafety({
			conversationId: existing.id as string,
			categories: inputScreen.categories.filter((c) => c.kind === "injection"),
		});
	}
	// Text persisted for the user turn (and therefore fed to the model from the
	// DB thread). Identical to lastUserText unless PII redaction is enabled.
	const contentToStore = inputScreen.redactedText;

	// Off-topic pre-check (feature-flagged). Cheap vocabulary-overlap test that
	// short-circuits a Pro call when a turn looks confidently off-topic — no
	// image attachments here because vision turns may legitimately have no
	// text overlap (e.g. "what's in this diagram"). The pre-check is also a
	// no-op for chunk-only / non-topic chats where vocab is too sparse.
	if (isDoubtScopePrecheckEnabled() && !hasAttachments) {
		const chunkText =
			groundedScope.kind === "topic"
				? groundedScope.topic.contextChunksBlock ?? ""
				: groundedScope.chapter.contextChunksBlock ?? "";
		if (chunkText.length > 0) {
			const verdict = userTurnLikelyOutOfScope(lastUserText, buildScopeVocab(chunkText));
			if (!verdict.ok) {
				void recordPracticeEvent(
					supabase,
					"doubt_chat_off_topic_blocked",
					{
						code: verdict.code,
						user_tokens: verdict.userTokens,
						vocab_size: verdict.vocabSize,
						subject_id: subjectId,
						topic_id: topicId,
					},
					{ studentId: user.id },
				);
				return new Response(
					JSON.stringify({
						error: OFF_TOPIC_USER_MESSAGE,
						code: "off_topic",
					}),
					{ status: 422, headers: { "content-type": "application/json" } },
				);
			}
		}
	}

	const conversationId = existing.id as string;

	// Load attachments (needed to route based on KIND — a PDF-only turn stays on
	// DeepSeek, only image attachments force the OpenAI fallback) and the admin
	// DB-prompt override concurrently. The prompt lookup depends only on tutorMode,
	// so it need not wait on the attachment round-trip; both are awaited together,
	// so the early-return below leaves no floating promise.
	const doubtFeature = doubtFeatureForMode(tutorMode);
	const [attachments, dbPrompt] = await Promise.all([
		loadAttachmentsForRequest(supabase, conversationId, attachmentIds),
		getActiveAiPrompt(doubtFeature),
	]);
	if (attachments.length !== attachmentIds.length) {
		return new Response(
			JSON.stringify({ error: "One or more attachments could not be found." }),
			{ status: 400, headers: { "content-type": "application/json" } },
		);
	}
	const hasImageAttachment = attachments.some((a) => a.kind === "image");

	// Image content can't be screened deterministically without a vision model
	// (excluded by design). Record every image turn for audit, and sample a
	// configurable fraction into the human review queue (rate defaults to 0).
	if (hasImageAttachment) {
		void recordPracticeEvent(
			supabase,
			"doubt_chat_image_attached",
			{
				subject_id: subjectId,
				topic_id: topicId,
				image_count: attachments.filter((a) => a.kind === "image").length,
			},
			{ studentId: user.id },
		);
		if (shouldSampleImageForReview()) {
			void flagDoubtImageForReview({ conversationId });
		}
	}

	// Per the migration plan: turns with an image attachment stay on OpenAI
	// (vision). Text-only turns AND pdf-only turns route via env
	// (`AI_PROVIDER_DOUBT_CHAT`, currently `deepseek`).
	const resolved = resolveChatModel("doubt.chat", { hasImageAttachment });
	const modelId = resolved.modelId;
	// When the admin has activated a DB-prompt override, use it verbatim —
	// they're taking responsibility for the full template (including any
	// subject-pack content). Otherwise compose preamble + subject pack
	// (if matched) + scope + mode tail from the file-based templates.
	const templateSrc = dbPrompt?.template?.trim()
		? dbPrompt.template
		: getDoubtModeTemplateForScope(groundedScope, tutorMode);
	let system = interpolateDoubtPromptTemplate(templateSrc, groundedScope);

	// Mode-switch handoff: if the previous turn was sent under a different mode,
	// append a one-line ephemeral note so the model treats earlier turns as
	// historical context under the old contract. Deliberately a SUFFIX (not a
	// prefix) so it doesn't perturb DeepSeek's cached prefix on this turn — the
	// note adds a few uncached tokens at the end, the rest of the prompt still
	// hits prior-conversation cache as normal.
	if (previousTutorMode && previousTutorMode !== tutorMode) {
		system += `\n\nNote: the student just switched from ${previousTutorMode.replace("_", "-")} mode to ${tutorMode.replace("_", "-")} mode. Treat earlier turns as historical context only; respond to the next turn under the new mode.`;
	}

	// Safety floor: guarantee the non-negotiable safety rules are present even
	// when an admin DB-prompt override replaced the file preamble verbatim. No-op
	// for file-based prompts (they already carry the crisis-line anchors), so the
	// DeepSeek cached prefix is unaffected.
	system = ensureDoubtSafetyFloor(system);

	const userMessageBase = {
		conversation_id: conversationId,
		role: "user" as const,
		content: contentToStore,
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
		{
			// Fires only for freshly-extracted attachments on this turn (historical
			// rows already have ocr_text and are skipped), so we don't re-flag the
			// same upload every follow-up turn.
			onAttachmentInjectionDetected: (attachmentId) => {
				void flagDoubtAttachmentInjection({ attachmentId });
				void recordPracticeEvent(
					supabase,
					"doubt_chat_attachment_injection_flagged",
					{ attachment_id: attachmentId },
					{ studentId: user.id },
				);
			},
		},
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

	// DeepSeek's thinking-mode endpoint returns HTTP 400 if `reasoning_content`
	// appears inside any input message. The Vercel SDK normally maps assistant
	// `reasoning` parts back into the request payload, so we strip those parts
	// from prior assistant turns before forwarding. OpenAI tolerates them either
	// way — safe to do unconditionally.
	if (resolved.provider === "deepseek") {
		modelMessages = stripReasoningPartsFromMessages(modelMessages);
		// DeepSeek doesn't accept image inputs; strip any historical image parts
		// the decorator re-attached and leave a text breadcrumb so the model
		// still understands an image existed in that earlier turn.
		modelMessages = stripImagePartsFromMessages(modelMessages);
	}

	const streamStartedAt = Date.now();
	const streamOutcome = streamTextWithProviderFallback({
		feature: "doubt.chat",
		resolved,
		streamArgs: {
			system,
			messages: modelMessages,
			// D29: surface AI SDK internals (token counts, model id, finish reason)
			// to Sentry traces. `recordTelemetry` doesn't currently wire to OTel, so
			// we manually forward in `onFinish` below; setting `isEnabled` lets the
			// AI SDK emit OTLP spans if a tracer is configured (no-op otherwise).
			experimental_telemetry: {
				isEnabled: true,
				functionId: "student.doubt-chat",
				metadata: {
					route: "/api/student/doubt-chat",
					model: modelId,
				},
			},
			// Cancel the model HTTP call when the client disconnects so we stop
			// paying for tokens after the user closes the tab.
			abortSignal: req.signal,
			onFinish: async ({ text, totalUsage, finishReason, providerMetadata }) => {
			const promptT = totalUsage?.inputTokens ?? null;
			const compT = totalUsage?.outputTokens ?? null;
			const reasoningTokens = extractReasoningTokens(
				totalUsage as { reasoningTokens?: number | null } | undefined,
			);
			const cacheTokens = extractDeepSeekCacheTokens(
				providerMetadata as Record<string, unknown> | undefined,
			);
			const latencyMs = Date.now() - streamStartedAt;
			// D29: forward usage/latency/model to Sentry with the route tag so
			// dashboards can slice on this without joining against the DB.
			Sentry.getCurrentScope().setTag("ai.route", "/api/student/doubt-chat");
			Sentry.getCurrentScope().setTag("ai.provider", streamOutcome.resolved.provider);
			if (streamOutcome.providerFallback) {
				Sentry.getCurrentScope().setTag("ai.provider_fallback", "true");
			}
			Sentry.addBreadcrumb({
				category: "ai",
				level: "info",
				message: "doubt-chat stream finished",
				data: {
					provider: streamOutcome.resolved.provider,
					model: streamOutcome.modelId,
					promptTokens: promptT,
					outputTokens: compT,
					reasoningTokens,
					cacheHitTokens: cacheTokens.cacheHitTokens,
					cacheMissTokens: cacheTokens.cacheMissTokens,
					latencyMs,
					finishReason,
				},
			});
			// Telemetry runs unconditionally — we want visibility on aborts/errors too.
			void recordAiCall({
				feature: "doubt.chat",
				model: streamOutcome.modelId,
				userId: user.id,
				promptId: dbPrompt?.id ?? null,
				inputTokens: promptT ?? 0,
				outputTokens: compT ?? 0,
				reasoningTokens,
				cacheHitTokens: cacheTokens.cacheHitTokens,
				cacheMissTokens: cacheTokens.cacheMissTokens,
				provider: streamOutcome.resolved.provider,
				latencyMs,
				status: "ok",
			});
			// Bill only normal completions (not provider errors, aborts, or tool loops).
			// Note: the `latencyMs` constant above is reused so DB telemetry and
			// Sentry breadcrumbs agree on the wall-clock measurement.
			// Aborted/errored streams skip persistence entirely so the sidebar doesn't
			// reorder for half-baked answers.
			const billableTurn = finishReason === "stop" || finishReason === "length";
			let asstErr: { message: string } | null = null;
			if (billableTurn) {
				// Deterministic output guard (no LLM). The student may have seen the
				// streamed tokens once, but if the completed answer trips a slur /
				// profanity / blacklist rule we persist a safe placeholder instead of
				// the raw text — so history reloads and the parent view never show it —
				// and raise a flag for review. Clean output (the overwhelming common
				// case) is stored verbatim.
				const outputScreen = await screenDoubtOutput(text);
				const safeContent = outputScreen.safe ? text : SAFE_OUTPUT_PLACEHOLDER;
				if (!outputScreen.safe) {
					void flagDoubtSafety({ conversationId, categories: outputScreen.categories });
					void recordPracticeEvent(
						supabase,
						"doubt_chat_output_flagged",
						{ sources: outputScreen.categories.map((c) => c.source) },
						{ studentId: user.id },
					);
				}
				// Run the two independent writes in parallel — saves 150–300ms per turn.
				const [insertResult, updateResult] = await Promise.allSettled([
					supabase.from("doubt_messages").insert({
						conversation_id: conversationId,
						role: "assistant",
						content: safeContent,
						prompt_tokens: promptT,
						completion_tokens: compT,
						model: streamOutcome.modelId,
					}),
					supabase
						.from("doubt_conversations")
						.update({ updated_at: new Date().toISOString(), model: streamOutcome.modelId })
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
		},
	});

	const result = streamOutcome.result;

	// `sendReasoning: false` keeps DeepSeek's CoT server-side; the student sees
	// only the final answer. Reasoning tokens are still billed and logged via
	// onFinish above, but we never include them in the user-facing stream.
	return result.toUIMessageStreamResponse({
		headers,
		sendReasoning: false,
		// M-4: a mid-stream model/transport failure would otherwise surface as
		// the AI SDK's default masked "An error occurred." with no server log.
		// Log it (no PII — message only) and return a stable, friendly string so
		// the client renders a consistent error rather than an opaque one.
		onError: (error) => {
			logSupabaseError(
				"doubt_chat.stream_error",
				{ message: error instanceof Error ? error.message : String(error) },
				{ conversationId },
			);
			return "The tutor ran into a problem while answering. Please try again.";
		},
	});
}
