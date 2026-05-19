"use server";

import { z } from "zod";

import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { consumeTeacherPortalDataActionRateLimit } from "@/lib/teachers/teacher-portal-action-rate-limit";
import { withTeacherActionTelemetry } from "@/lib/teachers/teacher-action-observability";
import {
	listTeacherTopicPerformanceRows,
	type TeacherTopicPerformanceRow,
} from "@/lib/teachers/teacher-topic-performance-queries";

export type TeacherTopicPerformanceDirectoryActionResult =
	| { rows: TeacherTopicPerformanceRow[] }
	| { error: string };

const filtersSchema = z
	.object({
		grade: z.union([z.literal("all"), z.coerce.number().int().min(6).max(12)]),
		section: z.union([z.literal("all"), z.string().max(8)]),
		subjectId: z.union([z.literal("all"), z.string().uuid()]),
	})
	.strict();

export async function fetchTeacherTopicPerformanceDirectory(
	raw: unknown,
): Promise<TeacherTopicPerformanceDirectoryActionResult> {
	return withTeacherActionTelemetry("fetchTeacherTopicPerformanceDirectory", async (breadcrumb) => {
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

		const { grade, section, subjectId } = parsed.data;

		const rows = await listTeacherTopicPerformanceRows({
			teacherId: session.user.id,
			activeOrganizationId: activeOrg?.id ?? null,
			grade: grade === "all" ? undefined : grade,
			section: section === "all" ? undefined : section,
			subjectId: subjectId === "all" ? undefined : subjectId,
		});

		breadcrumb("topic_directory_loaded", { count: rows.length });
		return { rows };
	});
}
