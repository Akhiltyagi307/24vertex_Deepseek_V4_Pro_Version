import { streamObject } from "ai";

import { getOpenAIProvider } from "@/lib/ai/openai-provider";
import { getOpenAIChatModel } from "@/lib/env";
import {
	buildPracticeSystemPrompt,
	buildPracticeUserMessage,
	createPracticeGenerationOutputSchema,
	finalizePracticeConfigSchema,
	resolvePracticeConfigForStudent,
	stringifyPracticeUserMessage,
} from "@/lib/practice";
import { getPracticeQuestionPlan } from "@/lib/practice/constants";
import { consumeGenerationRateLimit } from "@/lib/practice/practice-rate-limit";
import { preflightPracticeTestQuota } from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Phase 3 streaming variant. Accepts the same payload as
 * `generatePracticeTest` but returns an NDJSON-like stream of partial objects
 * so the wizard (Phase 4) can surface progress against the duration-derived
 * question total.
 *
 * Gated by `PRACTICE_STREAM=true`. When disabled, returns 404 so clients fall
 * back to the non-streaming server action.
 *
 * Usage: only {@link preflightPracticeTestQuota} runs here (no `consumeTest`).
 * Billable tests are counted in `generatePracticeTest` after `practice_generate_test`
 * succeeds, so streaming previews cannot double-charge before a persisted test exists.
 */
export async function POST(request: Request) {
	if (process.env.PRACTICE_STREAM !== "true") {
		return Response.json({ ok: false, message: "Streaming disabled." }, { status: 404 });
	}

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return Response.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
	}

	const parsed = finalizePracticeConfigSchema.safeParse(json);
	if (!parsed.success) {
		return Response.json(
			{ ok: false, message: "Invalid configuration." },
			{ status: 400 },
		);
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	const rateGate = await consumeGenerationRateLimit(supabase);
	if (!rateGate.ok) {
		return Response.json({ ok: false, message: rateGate.message }, { status: 429 });
	}

	const billingGate = await preflightPracticeTestQuota(supabase, user.id);
	if (!billingGate.ok) {
		return Response.json(
			{ ok: false, message: billingGate.message, code: billingGate.code, paywall: true },
			{ status: 402 },
		);
	}

	const resolved = await resolvePracticeConfigForStudent(supabase, parsed.data);
	if (!resolved.ok) {
		return Response.json({ ok: false, message: resolved.message }, { status: 400 });
	}

	const plan = getPracticeQuestionPlan(parsed.data.durationSeconds);

	const userPayload = buildPracticeUserMessage({
		studentGrade: resolved.studentGrade,
		subject: { id: parsed.data.subjectId, name: resolved.subjectName },
		difficulty: parsed.data.difficulty,
		timeLimitSeconds: parsed.data.durationSeconds,
		recentErrors: resolved.recentErrors,
		topics: resolved.canonicalTopics,
	});

	const systemPrompt = buildPracticeSystemPrompt({
		userMessageSummary: {
			schema_version: userPayload.schema_version,
			intent: userPayload.intent,
			test_parameters: userPayload.test_parameters,
			constraints: userPayload.constraints,
		},
	});
	const userPrompt = stringifyPracticeUserMessage(userPayload);

	const result = streamObject({
		model: getOpenAIProvider()(getOpenAIChatModel()),
		schema: createPracticeGenerationOutputSchema(plan.counts),
		system: systemPrompt,
		prompt: userPrompt,
		maxOutputTokens: Math.min(32_000, Math.max(6_000, plan.total * 900)),
		maxRetries: 2,
		providerOptions: {
			openai: { strictJsonSchema: false },
		},
	});

	return result.toTextStreamResponse();
}
