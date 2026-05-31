import "server-only";

import { z } from "zod";

import { generateStructuredWithProviderFallback } from "@/lib/ai/structured-output";
import { resolveChatModel } from "@/lib/ai/model-router";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import { practiceDifficultySchema } from "@/lib/practice";
import type {
	StudentInterventionTarget,
	StudentWeakTopic,
} from "@/lib/teachers/teacher-student-weak-topics-queries";

const INTERVENTION_FEATURE = "teacher.at_risk_intervention" as const;
const FOCUS_TOPICS_FALLBACK_COUNT = 4;

export const atRiskInterventionModelSchema = z
	.object({
		diagnosis: z.string().min(1).max(600),
		suggestedTitle: z.string().min(1).max(120),
		suggestedDifficulty: practiceDifficultySchema,
		/** 1-based positions into the numbered weak-topic list shown in the prompt. */
		focusTopicNumbers: z.array(z.number().int().min(1)).max(20),
	})
	.strict();

export type AtRiskInterventionPlan = {
	diagnosis: string;
	suggestedTitle: string;
	suggestedDifficulty: z.infer<typeof practiceDifficultySchema>;
	subjectId: string;
	subjectName: string;
	focusTopics: StudentWeakTopic[];
};

/**
 * Map the model's 1-based topic picks back onto the real weak-topic list,
 * dropping out-of-range or duplicate picks and preserving weak-first order.
 * Falls back to the weakest few topics when the model returns nothing usable,
 * so we never produce an assignment with zero topics. Pure + exported for tests.
 */
export function resolveFocusTopics(
	weakTopics: StudentWeakTopic[],
	focusTopicNumbers: number[],
): StudentWeakTopic[] {
	const seen = new Set<string>();
	const picked: StudentWeakTopic[] = [];
	for (const oneBased of focusTopicNumbers) {
		const topic = weakTopics[oneBased - 1];
		if (!topic || seen.has(topic.topicId)) continue;
		seen.add(topic.topicId);
		picked.push(topic);
	}
	if (picked.length > 0) return picked;
	return weakTopics.slice(0, Math.min(FOCUS_TOPICS_FALLBACK_COUNT, weakTopics.length));
}

export function buildAtRiskInterventionPrompt(params: {
	studentName: string;
	target: StudentInterventionTarget;
	recentSummary: string;
}): { system: string; prompt: string } {
	const { studentName, target, recentSummary } = params;

	const system = [
		"You are an instructional coach for teachers on an NCERT-aligned (grades 6-12, India) practice platform.",
		"A teacher has one student flagged as at-risk. Using the student's weakest topics, design a short remedial practice assignment.",
		"Rules:",
		"- 'diagnosis': 2-3 plain sentences on why this student is struggling, naming the specific weak topics. Never invent topics or numbers not in the data.",
		"- 'suggestedTitle': a short, student-facing assignment title (max ~8 words).",
		"- 'suggestedDifficulty': one of easy, medium, hard — pick what suits a struggling student (usually easy or medium; reserve hard for borderline cases).",
		"- 'focusTopicNumbers': the 2-5 highest-impact topics to drill, given by their NUMBER in the list below (not their name).",
	].join("\n");

	const topicLines = target.topics
		.map(
			(topic, index) =>
				`${index + 1}. ${topic.topicName} — avg ${topic.averagePercent}% over ${topic.testsTaken} test${topic.testsTaken === 1 ? "" : "s"}`,
		)
		.join("\n");

	const prompt = [
		`STUDENT: ${studentName}`,
		`SUBJECT: ${target.subjectName}`,
		`RISK_SIGNAL: ${recentSummary}`,
		"",
		"WEAK_TOPICS (numbered, weakest first):",
		topicLines,
	].join("\n");

	return { system, prompt };
}

export async function generateAtRiskInterventionPlan(params: {
	studentName: string;
	target: StudentInterventionTarget;
	recentSummary: string;
	teacherUserId: string;
}): Promise<AtRiskInterventionPlan> {
	const { studentName, target, recentSummary, teacherUserId } = params;

	const resolved = resolveChatModel(INTERVENTION_FEATURE);
	const { system, prompt } = buildAtRiskInterventionPrompt({ studentName, target, recentSummary });
	const startedAt = Date.now();

	try {
		const result = await generateStructuredWithProviderFallback({
			resolved,
			schema: atRiskInterventionModelSchema,
			system,
			prompt,
			feature: INTERVENTION_FEATURE,
		});

		await recordAiCall({
			feature: INTERVENTION_FEATURE,
			model: result.telemetry.modelId,
			userId: teacherUserId,
			inputTokens: result.usage.inputTokens ?? 0,
			outputTokens: result.usage.outputTokens ?? 0,
			latencyMs: Date.now() - startedAt,
			status: "ok",
			provider: result.telemetry.provider,
			reasoningTokens: result.telemetry.reasoningTokens,
			cacheHitTokens: result.telemetry.cacheHitTokens,
			cacheMissTokens: result.telemetry.cacheMissTokens,
		});

		return {
			diagnosis: result.object.diagnosis,
			suggestedTitle: result.object.suggestedTitle,
			suggestedDifficulty: result.object.suggestedDifficulty,
			subjectId: target.subjectId,
			subjectName: target.subjectName,
			focusTopics: resolveFocusTopics(target.topics, result.object.focusTopicNumbers),
		};
	} catch (error) {
		await recordAiCall({
			feature: INTERVENTION_FEATURE,
			model: resolved.modelId,
			userId: teacherUserId,
			inputTokens: 0,
			outputTokens: 0,
			latencyMs: Date.now() - startedAt,
			status: "error",
			provider: resolved.provider,
			error: error instanceof Error ? error.message : "unknown error",
		});
		throw error;
	}
}
