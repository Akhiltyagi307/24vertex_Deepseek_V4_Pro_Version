"use server";

import { z } from "zod";

import { listTeacherAssignableStudents } from "@/lib/assignments/queries";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import {
	getTeacherStudentPerformanceBandsForSubject,
} from "@/lib/teachers/teacher-class-performance-summary";
import { getTeacherSubjectScope, isSubjectOutOfScope } from "@/lib/teachers/teacher-subject-scope";
import type { TeacherPerformanceBandId } from "@/lib/teachers/teacher-class-performance-summary-types";
import { consumeTeacherPortalDataActionRateLimit } from "@/lib/teachers/teacher-portal-action-rate-limit";
import { withTeacherActionTelemetry } from "@/lib/teachers/teacher-action-observability";

const payloadSchema = z
	.object({
		subjectId: z.string().uuid(),
		studentIds: z.array(z.string().uuid()).max(500),
	})
	.strict();

export type FetchAssignableStudentBandsResult =
	| { bands: Record<string, TeacherPerformanceBandId | null> }
	| { error: string };

/** Performance band per assignable student for the selected subject (dashboard rules: last 5 graded items, assignments + practice). */
export async function fetchAssignableStudentPerformanceBands(
	raw: unknown,
): Promise<FetchAssignableStudentBandsResult> {
	return withTeacherActionTelemetry("fetchAssignableStudentPerformanceBands", async (breadcrumb) => {
		const parsed = payloadSchema.safeParse(raw);
		if (!parsed.success) {
			breadcrumb("validation_failed");
			return { error: parsed.error.flatten().formErrors[0] ?? "Invalid request." };
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
		if (isSubjectOutOfScope(scope, parsed.data.subjectId)) {
			breadcrumb("subject_out_of_scope");
			return { error: "You can only view bands for subjects you teach." };
		}

		const assignable = await listTeacherAssignableStudents(session.user.id);
		const allowed = new Set(assignable.map((s) => s.id));
		const studentIds = parsed.data.studentIds.filter((id) => allowed.has(id));
		if (studentIds.length === 0) {
			breadcrumb("no_assignable_intersection");
			return { bands: {} };
		}

		const map = await getTeacherStudentPerformanceBandsForSubject({
			teacherId: session.user.id,
			studentIds,
			subjectId: parsed.data.subjectId,
		});

		breadcrumb("bands_loaded", { count: studentIds.length });
		return { bands: Object.fromEntries(map) };
	});
}
