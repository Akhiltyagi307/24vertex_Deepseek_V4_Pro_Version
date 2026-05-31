import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { teacherClassInsights } from "@/db/schema/teacher-insights";
import { logServerError } from "@/lib/server/log-supabase-error";

import { teacherClassInsightSchema, type TeacherClassInsight } from "./teacher-class-insight";

/** Dashboard scope, with `null` meaning "all" for that dimension. */
export type ClassInsightScope = {
	grade: number | null;
	section: string | null;
	subjectId: string | null;
};

export type CachedClassInsight = {
	id: string;
	dataFingerprint: string;
	insight: TeacherClassInsight;
};

function scopeConditions(teacherId: string, scope: ClassInsightScope, promptVersion: number) {
	return and(
		eq(teacherClassInsights.teacherId, teacherId),
		scope.grade == null
			? isNull(teacherClassInsights.grade)
			: eq(teacherClassInsights.grade, scope.grade),
		scope.section == null
			? isNull(teacherClassInsights.section)
			: eq(teacherClassInsights.section, scope.section),
		scope.subjectId == null
			? isNull(teacherClassInsights.subjectId)
			: eq(teacherClassInsights.subjectId, scope.subjectId),
		eq(teacherClassInsights.promptVersion, promptVersion),
	);
}

/**
 * The stored insight for a scope, if any. Validates the persisted JSON against
 * the current schema so a row written by an older shape degrades to a miss
 * (caller regenerates) instead of throwing.
 */
export async function lookupCachedInsight(params: {
	teacherId: string;
	scope: ClassInsightScope;
	promptVersion: number;
}): Promise<CachedClassInsight | null> {
	// The cache is strictly additive — any failure (incl. a not-yet-applied
	// migration) degrades to a miss so the dashboard never breaks on it.
	try {
		const [row] = await db
			.select({
				id: teacherClassInsights.id,
				dataFingerprint: teacherClassInsights.dataFingerprint,
				insight: teacherClassInsights.insight,
			})
			.from(teacherClassInsights)
			.where(scopeConditions(params.teacherId, params.scope, params.promptVersion))
			.limit(1);

		if (!row) return null;
		const parsed = teacherClassInsightSchema.safeParse(row.insight);
		if (!parsed.success) return null;
		return { id: row.id, dataFingerprint: row.dataFingerprint, insight: parsed.data };
	} catch (error) {
		logServerError("teacherClassInsight.lookup", error, { teacherId: params.teacherId });
		return null;
	}
}

/** Insert or overwrite the cached insight for a scope (one row per scope). */
export async function upsertCachedInsight(params: {
	teacherId: string;
	organizationId: string | null;
	scope: ClassInsightScope;
	promptVersion: number;
	dataFingerprint: string;
	insight: TeacherClassInsight;
	model: string | null;
	provider: string | null;
}): Promise<void> {
	const now = new Date();
	// Best-effort: a failed write just means the next view regenerates. Never
	// let a cache-write failure bubble up and fail the generation that succeeded.
	try {
		await db
			.insert(teacherClassInsights)
			.values({
				teacherId: params.teacherId,
				organizationId: params.organizationId,
				grade: params.scope.grade,
				section: params.scope.section,
				subjectId: params.scope.subjectId,
				promptVersion: params.promptVersion,
				dataFingerprint: params.dataFingerprint,
				insight: params.insight,
				model: params.model,
				provider: params.provider,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: [
					teacherClassInsights.teacherId,
					teacherClassInsights.grade,
					teacherClassInsights.section,
					teacherClassInsights.subjectId,
					teacherClassInsights.promptVersion,
				],
				set: {
					dataFingerprint: params.dataFingerprint,
					insight: params.insight,
					model: params.model,
					provider: params.provider,
					organizationId: params.organizationId,
					updatedAt: now,
				},
			});
	} catch (error) {
		logServerError("teacherClassInsight.upsert", error, { teacherId: params.teacherId });
	}
}

/**
 * Hit counter for cache observability + prune freshness: bumps served_count and
 * stamps last_served_at. Best-effort — a failed bump only skews the metric, so
 * it never throws into the serve path.
 */
export async function markClassInsightServed(id: string): Promise<void> {
	try {
		await db
			.update(teacherClassInsights)
			.set({
				servedCount: sql`${teacherClassInsights.servedCount} + 1`,
				lastServedAt: new Date(),
			})
			.where(eq(teacherClassInsights.id, id));
	} catch (error) {
		logServerError("teacherClassInsight.markServed", error, { insightId: id });
	}
}
