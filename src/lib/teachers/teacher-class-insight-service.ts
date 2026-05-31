import "server-only";

import {
	computeInsightFingerprint,
	generateTeacherClassInsight,
	hasEnoughDataForClassInsight,
	PROMPT_VERSION,
	type TeacherClassInsight,
} from "./teacher-class-insight";
import {
	lookupCachedInsight,
	markClassInsightServed,
	upsertCachedInsight,
	type ClassInsightScope,
} from "./teacher-class-insight-cache";
import type { TeacherClassPerformanceSummary } from "./teacher-class-performance-summary-types";

export type { ClassInsightScope } from "./teacher-class-insight-cache";

export type ClassInsightOutcome =
	| { status: "ok"; insight: TeacherClassInsight; source: "cache" | "fresh" }
	| { status: "insufficient_data" };

export type ClassInsightLookupOutcome = ClassInsightOutcome | { status: "miss" };

/** Translate dashboard filters ("all" sentinels) into a cache scope (null = all). */
export function toClassInsightScope(filters: {
	grade: number | "all";
	section: string | "all";
	subjectId: string | "all";
}): ClassInsightScope {
	return {
		grade: filters.grade === "all" ? null : filters.grade,
		section: filters.section === "all" ? null : filters.section,
		subjectId: filters.subjectId === "all" ? null : filters.subjectId,
	};
}

/**
 * Cache-first insight: serve the stored row when its fingerprint still matches
 * the freshly-computed summary, otherwise generate once (billed) and upsert.
 * The `hasEnoughDataForClassInsight` guard short-circuits before any DB or LLM
 * work, so empty scopes never spend a token or a row.
 */
export async function getOrGenerateClassInsight(params: {
	teacherUserId: string;
	organizationId: string | null;
	scope: ClassInsightScope;
	scopeLabel: string;
	summary: TeacherClassPerformanceSummary;
	/** Explicit "Regenerate" — skip the cache and force a new LLM call. */
	forceFresh?: boolean;
}): Promise<ClassInsightOutcome> {
	const { teacherUserId, organizationId, scope, scopeLabel, summary } = params;

	if (!hasEnoughDataForClassInsight(summary)) {
		return { status: "insufficient_data" };
	}

	const fingerprint = computeInsightFingerprint(summary, PROMPT_VERSION);
	if (!params.forceFresh) {
		const cached = await lookupCachedInsight({
			teacherId: teacherUserId,
			scope,
			promptVersion: PROMPT_VERSION,
		});
		if (cached && cached.dataFingerprint === fingerprint) {
			await markClassInsightServed(cached.id);
			return { status: "ok", insight: cached.insight, source: "cache" };
		}
	}

	const generated = await generateTeacherClassInsight({ summary, scopeLabel, teacherUserId });
	if (generated.status !== "ok") {
		return generated;
	}

	await upsertCachedInsight({
		teacherId: teacherUserId,
		organizationId,
		scope,
		promptVersion: PROMPT_VERSION,
		dataFingerprint: fingerprint,
		insight: generated.insight,
		model: null,
		provider: null,
	});

	return { status: "ok", insight: generated.insight, source: "fresh" };
}

/**
 * Read-only cache probe — never generates. Used on the dashboard load /
 * filter-change path so a cache hit shows instantly for free, while a miss
 * leaves the explicit "Generate" affordance (no token spent on scope changes).
 */
export async function lookupClassInsightOnly(params: {
	teacherUserId: string;
	scope: ClassInsightScope;
	summary: TeacherClassPerformanceSummary;
}): Promise<ClassInsightLookupOutcome> {
	if (!hasEnoughDataForClassInsight(params.summary)) {
		return { status: "insufficient_data" };
	}

	const fingerprint = computeInsightFingerprint(params.summary, PROMPT_VERSION);
	const cached = await lookupCachedInsight({
		teacherId: params.teacherUserId,
		scope: params.scope,
		promptVersion: PROMPT_VERSION,
	});
	if (cached && cached.dataFingerprint === fingerprint) {
		await markClassInsightServed(cached.id);
		return { status: "ok", insight: cached.insight, source: "cache" };
	}
	return { status: "miss" };
}
