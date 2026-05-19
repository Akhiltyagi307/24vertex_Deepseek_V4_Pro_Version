"use server";

import { z } from "zod";

import {
	loadTeacherDashboardBundleForTeacher,
	type TeacherDashboardBundle,
} from "./teacher-dashboard-data";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { consumeTeacherPortalDataActionRateLimit } from "@/lib/teachers/teacher-portal-action-rate-limit";
import { withTeacherActionTelemetry } from "@/lib/teachers/teacher-action-observability";
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

		const activeOrg = await getActiveTeacherOrganizationSnapshot(session.user.id);

		const bundle = await loadTeacherDashboardBundleForTeacher({
			teacherId: session.user.id,
			activeOrganizationId: activeOrg?.id ?? null,
			filters: parsed.data,
		});
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
