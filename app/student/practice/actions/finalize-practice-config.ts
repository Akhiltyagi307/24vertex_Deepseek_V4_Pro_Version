"use server";

import {
	buildPracticeSystemPrompt,
	buildPracticeUserMessage,
	fetchTopicContextChunksByTopicIds,
	finalizePracticeConfigSchema,
	resolvePracticeConfigForStudent,
	stringifyPracticeUserMessageForModel,
} from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

import { mapResolveToFinalizeFailure, type FinalizePracticeResult } from "./types";

/**
 * Validates practice configuration server-side. Prompt text is returned only when
 * `PRACTICE_PROMPT_PREVIEW=true` (never rely on the client to request secrets).
 */
export async function finalizePracticeConfig(input: unknown): Promise<FinalizePracticeResult> {
	const parsed = finalizePracticeConfigSchema.safeParse(input);
	if (!parsed.success) {
		const flat = parsed.error.flatten();
		return {
			ok: false,
			code: "validation_error",
			message: "Check your selections and try again.",
			fieldErrors: flat.fieldErrors as Record<string, string[]>,
		};
	}

	const supabase = await createClient();
	const resolved = await resolvePracticeConfigForStudent(supabase, parsed.data);
	if (!resolved.ok) {
		return mapResolveToFinalizeFailure(resolved);
	}

	const { subjectId, difficulty, durationSeconds } = parsed.data;
	const previewEnabled = process.env.PRACTICE_PROMPT_PREVIEW === "true";

	if (!previewEnabled) {
		return { ok: true, code: "success" };
	}

	const topicIds = resolved.canonicalTopics.map((t) => t.topicId);
	// Topic chunks: service role after resolvePracticeConfigForStudent (enrollment verified).
	const admin = createServiceRoleClient();
	const preFetchedTopicContext = await fetchTopicContextChunksByTopicIds(admin, topicIds);

	const userPayload = buildPracticeUserMessage({
		studentGrade: resolved.studentGrade,
		subject: { id: subjectId, name: resolved.subjectName },
		difficulty,
		timeLimitSeconds: durationSeconds,
		recentErrors: resolved.recentErrors,
		topics: resolved.canonicalTopics,
		preFetchedTopicContext,
	});

	const systemPrompt = buildPracticeSystemPrompt({
		userMessageSummary: {
			schema_version: userPayload.schema_version,
			intent: userPayload.intent,
			test_parameters: userPayload.test_parameters,
			constraints: userPayload.constraints,
		},
		generationSubject: {
			subjectName: resolved.subjectName,
			subjectGrade: resolved.subjectGrade,
			subjectGroup: resolved.subjectGroup,
			studentGrade: resolved.studentGrade,
		},
	});

	return {
		ok: true,
		code: "success",
		userMessageJson: stringifyPracticeUserMessageForModel(userPayload),
		systemPrompt,
		canonicalTopics: resolved.canonicalTopics,
	};
}
