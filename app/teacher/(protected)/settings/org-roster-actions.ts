"use server";

import { z } from "zod";

import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { getActiveTeacherOrganizationSnapshot } from "@/lib/organizations/queries";
import { consumeTeacherPortalDataActionRateLimit } from "@/lib/teachers/teacher-portal-action-rate-limit";
import {
	getOrganizationRosterFilterOptions,
	listOrganizationStudentsWithFilters,
	type OrganizationRosterStudentRow,
} from "@/lib/teachers/roster-queries";

export type TeacherOrgRosterActionResult =
	| { rows: OrganizationRosterStudentRow[] }
	| { error: string };

export type TeacherOrgRosterTabDataResult =
	| {
			initialRows: OrganizationRosterStudentRow[];
			filterOptions: { grades: number[]; sections: string[] };
	  }
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

	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		return { error: session.message };
	}
	const rate = await consumeTeacherPortalDataActionRateLimit(session.user.id);
	if (!rate.ok) {
		return { error: rate.message };
	}

	const activeOrg = await getActiveTeacherOrganizationSnapshot(session.user.id);
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

export async function loadTeacherOrganizationRosterTabData(): Promise<TeacherOrgRosterTabDataResult> {
	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		return { error: session.message };
	}
	const rate = await consumeTeacherPortalDataActionRateLimit(session.user.id);
	if (!rate.ok) {
		return { error: rate.message };
	}

	const activeOrg = await getActiveTeacherOrganizationSnapshot(session.user.id);
	if (!activeOrg) {
		return { error: "Join an organization to view its student roster." };
	}

	const [initialRows, filterOptions] = await Promise.all([
		listOrganizationStudentsWithFilters({ organizationId: activeOrg.id }),
		getOrganizationRosterFilterOptions(activeOrg.id),
	]);

	return { initialRows, filterOptions };
}
