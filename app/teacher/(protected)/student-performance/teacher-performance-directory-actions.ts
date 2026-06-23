"use server";

import { z } from "zod";

import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { coerceFiltersToScope, getTeacherSubjectScope } from "@/lib/teachers/teacher-subject-scope";
import { consumeTeacherPortalDataActionRateLimit } from "@/lib/teachers/teacher-portal-action-rate-limit";
import { withTeacherActionTelemetry } from "@/lib/teachers/teacher-action-observability";
import {
	listTeacherPerformanceDirectoryRows,
	type TeacherPerformanceDirectoryRow,
} from "@/lib/teachers/teacher-performance-directory-queries";

export type TeacherPerformanceDirectoryActionResult =
	| { rows: TeacherPerformanceDirectoryRow[] }
	| { error: string };

const filtersSchema = z
	.object({
		grade: z.union([z.literal("all"), z.coerce.number().int().min(6).max(12)]),
		section: z.union([z.literal("all"), z.string().max(8)]),
		subjectId: z.union([z.literal("all"), z.string().uuid()]),
	})
	.strict();

export async function fetchTeacherPerformanceDirectory(
	raw: unknown,
): Promise<TeacherPerformanceDirectoryActionResult> {
	return withTeacherActionTelemetry("fetchTeacherPerformanceDirectory", async (breadcrumb) => {
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
		const scope = await getTeacherSubjectScope({
			activeOrganizationId: activeOrg?.id ?? null,
			subjectsTaught: session.profile.subjects_taught,
		});
		const { grade, subjectId } = coerceFiltersToScope(scope, {
			grade: parsed.data.grade,
			subjectId: parsed.data.subjectId,
		});
		const section = parsed.data.section;

		const rows = await listTeacherPerformanceDirectoryRows({
			teacherId: session.user.id,
			activeOrganizationId: activeOrg?.id ?? null,
			grade: grade === "all" ? undefined : grade,
			section: section === "all" ? undefined : section,
			subjectId: subjectId === "all" ? undefined : subjectId,
			gradesInScope: scope.isScoped ? scope.grades : undefined,
		});

		breadcrumb("directory_loaded", { count: rows.length });
		return { rows };
	});
}
