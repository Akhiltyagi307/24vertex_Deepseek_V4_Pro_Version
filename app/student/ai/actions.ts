"use server";

import { z } from "zod";

import { completeChatJson } from "@/lib/ai/json-completion";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getOpenAIChatModel } from "@/lib/env";
import { consumeStudyTipsRateLimit } from "@/lib/practice/practice-rate-limit";
import { createClient } from "@/lib/supabase/server";

const studyTipsRequestSchema = z.object({
	topic: z.string().min(1, "Enter a topic or goal.").max(500, "Keep it under 500 characters."),
});

const studyTipsResponseSchema = z.object({
	headline: z.string().min(1),
	tips: z.array(z.string().min(1)).min(1).max(5),
});

export type StudyTipsSuccess = {
	ok: true;
	headline: string;
	tips: string[];
};

export type StudyTipsFailure = {
	ok: false;
	code:
		| "unauthorized"
		| "not_student"
		| "validation_error"
		| "rate_limited"
		| "ai_unavailable"
		| "ai_parse_error";
	message: string;
	fieldErrors?: Record<string, string[]>;
};

export type StudyTipsResult = StudyTipsSuccess | StudyTipsFailure;

const STUDY_TIPS_SYSTEM = `You are a concise study coach for middle and high school students.
Respond with a single JSON object only (no markdown, no code fences) with this exact shape:
{"headline": string, "tips": string[]}
- headline: one short encouraging title (max 12 words)
- tips: 2-5 specific, actionable study tips for the topic
Rules: tips must be age-appropriate; do not encourage cheating or plagiarism; no medical or mental-health claims.`;

/**
 * Example one-shot structured LLM call (Vercel AI SDK): authenticated students only.
 * Reuse {@link completeChatJson} for other schemas and prompts.
 */
export async function requestStudyTipsJson(input: unknown): Promise<StudyTipsResult> {
	const parsedInput = studyTipsRequestSchema.safeParse(input);
	if (!parsedInput.success) {
		const flat = parsedInput.error.flatten();
		return {
			ok: false,
			code: "validation_error",
			message: "Check your input and try again.",
			fieldErrors: flat.fieldErrors as Record<string, string[]>,
		};
	}

	const user = await getServerUser();
	if (!user) {
		return { ok: false, code: "unauthorized", message: "Sign in to continue." };
	}
	const supabase = await createClient();

	const { data: profileRow, error: profileErr } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", user.id)
		.maybeSingle();

	if (profileErr || !profileRow || profileRow.role !== "student") {
		return {
			ok: false,
			code: "not_student",
			message: "This action is only available to students.",
		};
	}

	const rateGate = await consumeStudyTipsRateLimit(supabase);
	if (!rateGate.ok) {
		return { ok: false, code: "rate_limited", message: rateGate.message };
	}

	const ai = await completeChatJson({
		model: getOpenAIChatModel(),
		system: STUDY_TIPS_SYSTEM,
		user: `Topic or goal: ${parsedInput.data.topic}`,
		schema: studyTipsResponseSchema,
		telemetry: { feature: "student.study_tips", userId: user.id },
	});

	if (!ai.ok) {
		const isShape = ai.code === "schema_mismatch" || ai.code === "invalid_json";
		return {
			ok: false,
			code: isShape ? "ai_parse_error" : "ai_unavailable",
			message: isShape
				? "The assistant returned an unexpected format. Try again."
				: "The assistant is temporarily unavailable. Try again shortly.",
		};
	}

	return {
		ok: true,
		headline: ai.data.headline,
		tips: ai.data.tips,
	};
}
