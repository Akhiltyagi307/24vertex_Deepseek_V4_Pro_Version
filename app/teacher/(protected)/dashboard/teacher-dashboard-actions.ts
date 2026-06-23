"use server";

import { z } from "zod";

import {
	loadTeacherDashboardBundleForTeacher,
	type TeacherDashboardBundle,
	type TeacherDashboardFilters,
} from "./teacher-dashboard-data";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { coerceFiltersToScope, getTeacherSubjectScope } from "@/lib/teachers/teacher-subject-scope";
import { consumeTeacherPortalDataActionRateLimit } from "@/lib/teachers/teacher-portal-action-rate-limit";
import { withTeacherActionTelemetry } from "@/lib/teachers/teacher-action-observability";
import { classifyTeacherActionError } from "@/lib/teachers/classify-teacher-action-error";
import {
	getOrGenerateClassInsight,
	lookupClassInsightOnly,
	toClassInsightScope,
	type ClassInsightLookupOutcome,
	type ClassInsightOutcome,
} from "@/lib/teachers/teacher-class-insight-service";
import type { TeacherClassPerformanceSummary } from "@/lib/teachers/teacher-class-performance-summary-types";
import type { TeacherAtRiskStudentRow } from "@/lib/teachers/teacher-at-risk-types";

export type TeacherAtRiskActionResult =
	| { rows: TeacherAtRiskStudentRow[] }
	| { error: string };

export type TeacherClassPerformanceActionResult =
	| { summary: TeacherClassPerformanceSummary }
	| { error: string };

export type TeacherDashboardBundleActionResult =
	| TeacherDashboardBundle
	| { error: string };

const filtersSchema = z
	.object({
		grade: z.union([z.literal("all"), z.coerce.number().int().min(6).max(12)]),
		section: z.union([z.literal("all"), z.string().max(8)]),
		subjectId: z.union([z.literal("all"), z.string().uuid()]),
	})
	.strict();

/**
 * Resolve the teacher's subject scope, clamp any out-of-scope grade/subject filter
 * back to "all", and load the dashboard bundle bounded to the teacher's taught grades.
 * Returns the coerced filters so the insight scope/fingerprint matches the summary.
 */
async function resolveScopedDashboardBundle(
	teacherUserId: string,
	subjectsTaught: string[] | null,
	rawFilters: TeacherDashboardFilters,
): Promise<{
	bundle: TeacherDashboardBundle;
	activeOrganizationId: string | null;
	filters: TeacherDashboardFilters;
}> {
	const activeOrg = await getActiveTeacherOrganizationSnapshot(teacherUserId);
	const scope = await getTeacherSubjectScope({
		activeOrganizationId: activeOrg?.id ?? null,
		subjectsTaught,
	});
	const coerced = coerceFiltersToScope(scope, {
		grade: rawFilters.grade,
		subjectId: rawFilters.subjectId,
	});
	const filters: TeacherDashboardFilters = {
		grade: coerced.grade,
		section: rawFilters.section,
		subjectId: coerced.subjectId,
	};
	const bundle = await loadTeacherDashboardBundleForTeacher({
		teacherId: teacherUserId,
		activeOrganizationId: activeOrg?.id ?? null,
		filters,
		gradesInScope: scope.isScoped ? scope.grades : undefined,
	});
	return { bundle, activeOrganizationId: activeOrg?.id ?? null, filters };
}

export async function fetchTeacherDashboardBundle(
	raw: unknown,
): Promise<TeacherDashboardBundleActionResult> {
	return withTeacherActionTelemetry("fetchTeacherDashboardBundle", async (breadcrumb) => {
		const parsed = filtersSchema.safeParse(raw);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { error: parsed.error.flatten().formErrors[0] ?? "Invalid filters." };
		}

		const session = await getVerifiedTeacherSession();
		if (!session.ok) {
			breadcrumb("auth_failed", { code: session.code });
			return { error: session.message };
		}
		const rate = await consumeTeacherPortalDataActionRateLimit(session.user.id);
		if (!rate.ok) {
			breadcrumb("rate_limited");
			return { error: rate.message };
		}

		const { bundle } = await resolveScopedDashboardBundle(
			session.user.id,
			session.profile.subjects_taught,
			parsed.data,
		);
		breadcrumb("dashboard_loaded");
		return bundle;
	});
}

export async function fetchTeacherAtRiskStudents(raw: unknown): Promise<TeacherAtRiskActionResult> {
	return withTeacherActionTelemetry("fetchTeacherAtRiskStudents", async () => {
		const result = await fetchTeacherDashboardBundle(raw);
		if ("error" in result) {
			return result;
		}
		return { rows: result.atRiskRows };
	});
}

export async function fetchTeacherClassPerformanceSummary(
	raw: unknown,
): Promise<TeacherClassPerformanceActionResult> {
	return withTeacherActionTelemetry("fetchTeacherClassPerformanceSummary", async () => {
		const result = await fetchTeacherDashboardBundle(raw);
		if ("error" in result) {
			return result;
		}
		return { summary: result.summary };
	});
}

export type TeacherClassInsightActionResult = ClassInsightOutcome | { error: string };

const insightInputSchema = filtersSchema
	.extend({ scopeLabel: z.string().max(160).optional(), force: z.boolean().optional() })
	.strict();

/**
 * On-demand AI narration of the current dashboard scope. Recomputes the summary
 * server-side from validated filters (never trusts a client-supplied summary);
 * `scopeLabel` is cosmetic prompt context only. Billed per call — the UI gates
 * this behind an explicit button so page loads never spend a token.
 */
export async function generateTeacherClassInsightAction(
	raw: unknown,
): Promise<TeacherClassInsightActionResult> {
	return withTeacherActionTelemetry("generateTeacherClassInsightAction", async (breadcrumb) => {
		const parsed = insightInputSchema.safeParse(raw);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { error: parsed.error.flatten().formErrors[0] ?? "Invalid filters." };
		}

		const session = await getVerifiedTeacherSession();
		if (!session.ok) {
			breadcrumb("auth_failed", { code: session.code });
			return { error: session.message };
		}
		const rate = await consumeTeacherPortalDataActionRateLimit(session.user.id);
		if (!rate.ok) {
			breadcrumb("rate_limited");
			return { error: rate.message };
		}

		const { bundle, activeOrganizationId, filters } = await resolveScopedDashboardBundle(
			session.user.id,
			session.profile.subjects_taught,
			parsed.data,
		);

		try {
			const outcome = await getOrGenerateClassInsight({
				teacherUserId: session.user.id,
				organizationId: activeOrganizationId,
				scope: toClassInsightScope(filters),
				scopeLabel: parsed.data.scopeLabel?.trim() || "Selected scope",
				summary: bundle.summary,
				forceFresh: parsed.data.force,
			});
			breadcrumb(outcome.status === "ok" ? `insight_${outcome.source}` : "insufficient_data");
			return outcome;
		} catch (err) {
			breadcrumb("insight_failed");
			return {
				error: classifyTeacherActionError(err, {
					action: "generateTeacherClassInsightAction",
					userId: session.user.id,
				}).userMessage,
			};
		}
	});
}

export type TeacherClassInsightLookupActionResult = ClassInsightLookupOutcome | { error: string };

/**
 * Read-only cache probe for the current scope — never calls the model. The card
 * runs this on dashboard load / filter change so a cached insight shows for free
 * (a miss just leaves the "Generate" button). Recomputes the summary server-side
 * to compute the fingerprint; the SSR path passes its already-loaded summary
 * instead of going through this action.
 */
export async function fetchCachedClassInsightAction(
	raw: unknown,
): Promise<TeacherClassInsightLookupActionResult> {
	return withTeacherActionTelemetry("fetchCachedClassInsightAction", async (breadcrumb) => {
		const parsed = insightInputSchema.safeParse(raw);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { error: parsed.error.flatten().formErrors[0] ?? "Invalid filters." };
		}

		const session = await getVerifiedTeacherSession();
		if (!session.ok) {
			breadcrumb("auth_failed", { code: session.code });
			return { error: session.message };
		}
		const rate = await consumeTeacherPortalDataActionRateLimit(session.user.id);
		if (!rate.ok) {
			breadcrumb("rate_limited");
			return { error: rate.message };
		}

		const { bundle, filters } = await resolveScopedDashboardBundle(
			session.user.id,
			session.profile.subjects_taught,
			parsed.data,
		);

		const outcome = await lookupClassInsightOnly({
			teacherUserId: session.user.id,
			scope: toClassInsightScope(filters),
			summary: bundle.summary,
		});
		breadcrumb(`insight_lookup_${outcome.status}`);
		return outcome;
	});
}
