import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import { generateStructuredWithProviderFallback } from "@/lib/ai/structured-output";
import { resolveChatModel } from "@/lib/ai/model-router";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import type { TeacherClassPerformanceSummary } from "@/lib/teachers/teacher-class-performance-summary-types";

const INSIGHT_FEATURE = "teacher.dashboard_insight" as const;

/**
 * Bump when the prompt, schema, or serialization changes in a way that should
 * invalidate every previously cached insight. Part of the cache key + the
 * fingerprint, so a bump transparently regenerates everything on next view
 * without a migration.
 */
export const PROMPT_VERSION = 1;

export const teacherClassInsightSchema = z
	.object({
		headline: z.string().min(1).max(120),
		narrative: z.string().min(1).max(600),
		actions: z
			.array(
				z
					.object({
						title: z.string().min(1).max(120),
						detail: z.string().min(1).max(280),
					})
					.strict(),
			)
			.min(1)
			.max(3),
	})
	.strict();

export type TeacherClassInsight = z.infer<typeof teacherClassInsightSchema>;

export type TeacherClassInsightResult =
	| { status: "ok"; insight: TeacherClassInsight }
	| { status: "insufficient_data" };

/**
 * The summary card narrates *existing* analytics, so there is nothing for the
 * model to say (and no reason to spend a token) until at least one student in
 * scope has a recent graded item. Pure + exported so the gate can be unit-tested
 * without standing up the model router.
 */
export function hasEnoughDataForClassInsight(summary: TeacherClassPerformanceSummary): boolean {
	return summary.classAveragePercent != null && summary.studentsWithRecentScores > 0;
}

/**
 * Deterministic sha256 over exactly the summary inputs that feed the prompt.
 * Used as the cache validity check: a stored insight is reused only while its
 * fingerprint still matches the freshly-computed summary. Topics are sorted by
 * id so an order change alone never changes the hash; numbers are already
 * rounded by the summary builder. Pure + exported for unit testing.
 */
export function computeInsightFingerprint(
	summary: TeacherClassPerformanceSummary,
	promptVersion: number,
): string {
	const canonical = {
		v: promptVersion,
		classAveragePercent: summary.classAveragePercent,
		studentsInScope: summary.studentsInScope,
		studentsWithRecentScores: summary.studentsWithRecentScores,
		recentGradedItemsUsed: summary.recentGradedItemsUsed,
		recentWindowSize: summary.recentWindowSize,
		bands: summary.performanceBands.map((band) => [band.id, band.count] as const),
		topics: summary.upliftOpportunities
			.map((topic) => ({
				id: topic.topicId,
				avg: topic.averagePercent,
				tested: topic.studentsTested,
				below: topic.studentsBelowSupportLine,
			}))
			.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
	};
	return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

function serializeSummaryForPrompt(
	summary: TeacherClassPerformanceSummary,
	scopeLabel: string,
): string {
	const bandLine = summary.performanceBands
		.map((band) => `${band.label}: ${band.count}`)
		.join(", ");

	const upliftLines =
		summary.upliftOpportunities.length > 0
			? summary.upliftOpportunities
					.map(
						(topic) =>
							`- ${topic.topicName} (${topic.subjectName}): class avg ${topic.averagePercent}%, ` +
							`${topic.studentsBelowSupportLine}/${topic.studentsTested} students below 60%`,
					)
					.join("\n")
			: "- (no topic-level weak spots detected in scope)";

	return [
		`SCOPE: ${scopeLabel}`,
		`STUDENTS_IN_SCOPE: ${summary.studentsInScope}`,
		`STUDENTS_WITH_RECENT_SCORES: ${summary.studentsWithRecentScores}`,
		`CLASS_AVERAGE_PERCENT: ${summary.classAveragePercent ?? "n/a"}`,
		`RECENT_WINDOW: latest ${summary.recentWindowSize} graded items per student (${summary.recentGradedItemsUsed} total counted)`,
		`PERFORMANCE_BANDS: ${bandLine}`,
		"WEAKEST_TOPICS (most worth a follow-up assignment, strongest signal first):",
		upliftLines,
	].join("\n");
}

export function buildTeacherClassInsightPrompt(
	summary: TeacherClassPerformanceSummary,
	scopeLabel: string,
): { system: string; prompt: string } {
	const system = [
		"You are an instructional coach for teachers on an NCERT-aligned (grades 6-12, India) practice platform.",
		"You are handed already-computed class performance analytics and must turn them into a short, specific briefing the teacher can act on.",
		"Rules:",
		"- Be concrete and reference the actual weak topics by name; never invent numbers or topics not present in the data.",
		"- Plain English, no jargon, no flattery. A busy teacher should grasp it in ten seconds.",
		"- 'headline': one scannable sentence capturing the single most important takeaway.",
		"- 'narrative': 2-3 sentences explaining what the numbers mean and the likely underlying gap.",
		"- 'actions': 1-3 concrete next steps (e.g. assign a follow-up on a named topic, small-group review). Each step concise and tied to the data.",
	].join("\n");

	const prompt = [
		"Summarise this class's recent performance for the teacher.",
		"",
		serializeSummaryForPrompt(summary, scopeLabel),
	].join("\n");

	return { system, prompt };
}

export async function generateTeacherClassInsight(params: {
	summary: TeacherClassPerformanceSummary;
	scopeLabel: string;
	teacherUserId: string;
}): Promise<TeacherClassInsightResult> {
	const { summary, scopeLabel, teacherUserId } = params;

	if (!hasEnoughDataForClassInsight(summary)) {
		return { status: "insufficient_data" };
	}

	const resolved = resolveChatModel(INSIGHT_FEATURE);
	const { system, prompt } = buildTeacherClassInsightPrompt(summary, scopeLabel);
	const startedAt = Date.now();

	try {
		const result = await generateStructuredWithProviderFallback({
			resolved,
			schema: teacherClassInsightSchema,
			system,
			prompt,
			feature: INSIGHT_FEATURE,
		});

		await recordAiCall({
			feature: INSIGHT_FEATURE,
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

		return { status: "ok", insight: result.object };
	} catch (error) {
		await recordAiCall({
			feature: INSIGHT_FEATURE,
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
