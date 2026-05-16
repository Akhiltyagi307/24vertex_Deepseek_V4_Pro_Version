"use server";

import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import {
	listTeacherTopicPerformanceRows,
	type TeacherTopicPerformanceRow,
} from "@/lib/teachers/teacher-topic-performance-queries";

export type TeacherTopicPerformanceDirectoryActionResult =
	| { rows: TeacherTopicPerformanceRow[] }
	| { error: string };

const filtersSchema = z.object({
	grade: z.union([z.literal("all"), z.coerce.number().int().min(6).max(12)]),
	section: z.union([z.literal("all"), z.string().max(8)]),
	subjectId: z.union([z.literal("all"), z.string().uuid()]),
});

export async function fetchTeacherTopicPerformanceDirectory(
	raw: unknown,
): Promise<TeacherTopicPerformanceDirectoryActionResult> {
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

	const rows = await listTeacherTopicPerformanceRows({
		teacherId: user.id,
		activeOrganizationId: activeOrg?.id ?? null,
		grade: grade === "all" ? undefined : grade,
		section: section === "all" ? undefined : section,
		subjectId: subjectId === "all" ? undefined : subjectId,
	});

	return { rows };
}
