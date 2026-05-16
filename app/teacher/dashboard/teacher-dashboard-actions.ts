"use server";

import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { getTeacherClassPerformanceSummary } from "@/lib/teachers/teacher-class-performance-summary";
import type { TeacherClassPerformanceSummary } from "@/lib/teachers/teacher-class-performance-summary-types";
import { listTeacherAtRiskStudents } from "@/lib/teachers/teacher-at-risk-queries";
import type { TeacherAtRiskStudentRow } from "@/lib/teachers/teacher-at-risk-types";

export type TeacherAtRiskActionResult =
	| { rows: TeacherAtRiskStudentRow[] }
	| { error: string };

export type TeacherClassPerformanceActionResult =
	| { summary: TeacherClassPerformanceSummary }
	| { error: string };

const filtersSchema = z.object({
	grade: z.union([z.literal("all"), z.coerce.number().int().min(6).max(12)]),
	section: z.union([z.literal("all"), z.string().max(8)]),
	subjectId: z.union([z.literal("all"), z.string().uuid()]),
});

export async function fetchTeacherAtRiskStudents(raw: unknown): Promise<TeacherAtRiskActionResult> {
	const parsed = filtersSchema.safeParse(raw);
	if (!parsed.success) {
		return { error: parsed.error.flatten().formErrors[0] ?? "Invalid filters." };
	}

	const user = await getServerUser();
	if (!user) {
		return { error: "Not signed in." };
	}

	const activeOrg = await getActiveTeacherOrganizationSnapshot(user.id);
	const { grade, section, subjectId } = parsed.data;

	const rows = await listTeacherAtRiskStudents({
		teacherId: user.id,
		activeOrganizationId: activeOrg?.id ?? null,
		grade,
		section,
		subjectId,
	});

	return { rows };
}

export async function fetchTeacherClassPerformanceSummary(
	raw: unknown,
): Promise<TeacherClassPerformanceActionResult> {
	const parsed = filtersSchema.safeParse(raw);
	if (!parsed.success) {
		return { error: parsed.error.flatten().formErrors[0] ?? "Invalid filters." };
	}

	const user = await getServerUser();
	if (!user) {
		return { error: "Not signed in." };
	}

	const activeOrg = await getActiveTeacherOrganizationSnapshot(user.id);
	const { grade, section, subjectId } = parsed.data;

	const summary = await getTeacherClassPerformanceSummary({
		teacherId: user.id,
		activeOrganizationId: activeOrg?.id ?? null,
		grade,
		section,
		subjectId,
	});

	return { summary };
}
