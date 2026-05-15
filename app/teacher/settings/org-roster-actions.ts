"use server";

import { z } from "zod";

import { getServerUser } from "@/lib/auth/get-server-user";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import {
	listOrganizationStudentsWithFilters,
	type OrganizationRosterStudentRow,
} from "@/lib/teachers/roster-queries";

export type TeacherOrgRosterActionResult =
	| { rows: OrganizationRosterStudentRow[] }
	| { error: string };

const rosterFiltersSchema = z.object({
	grade: z.union([z.literal("all"), z.coerce.number().int().min(6).max(12)]),
	section: z.union([z.literal("all"), z.string().max(8)]),
	subjectId: z.union([z.literal("all"), z.string().uuid()]),
});

export async function fetchTeacherOrganizationRoster(
	raw: unknown,
): Promise<TeacherOrgRosterActionResult> {
	const parsed = rosterFiltersSchema.safeParse(raw);
	if (!parsed.success) {
		return { error: parsed.error.flatten().formErrors[0] ?? "Invalid filters." };
	}

	const user = await getServerUser();
	if (!user) {
		return { error: "Not signed in." };
	}

	const activeOrg = await getActiveTeacherOrganizationSnapshot(user.id);
	if (!activeOrg) {
		return { error: "Join an organization to view its student roster." };
	}

	const { grade, section, subjectId } = parsed.data;

	const rows = await listOrganizationStudentsWithFilters({
		organizationId: activeOrg.id,
		grade: grade === "all" ? undefined : grade,
		section: section === "all" ? undefined : section,
		subjectId: subjectId === "all" ? undefined : subjectId,
	});

	return { rows };
}
