import "server-only";

import { and, asc, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
	organizations,
	teacherOrganizationMemberships,
	teacherStudentLinks,
} from "@/db/schema/organizations";
import { profiles } from "@/db/schema/profiles";
import {
	serializeOrganization,
	serializeOrganizationAdmin,
	type AdminOrganizationInput,
	type SerializedOrganization,
	type SerializedOrganizationAdmin,
} from "@/lib/organizations/schemas";

/** Columns for `serializeOrganization` only — omits `linking_code` so catalog reads work before linking-code migrations land on every DB. */
const organizationCatalogColumns = {
	id: organizations.id,
	type: organizations.type,
	name: organizations.name,
	externalId: organizations.externalId,
	faviconUrl: organizations.faviconUrl,
	isActive: organizations.isActive,
	deletedAt: organizations.deletedAt,
	createdAt: organizations.createdAt,
	updatedAt: organizations.updatedAt,
};

export async function listAdminOrganizations(): Promise<SerializedOrganizationAdmin[]> {
	const rows = await db
		.select()
		.from(organizations)
		.where(isNull(organizations.deletedAt))
		.orderBy(desc(organizations.isActive), asc(organizations.name));
	return rows.map(serializeOrganizationAdmin);
}

export async function listCatalogOrganizations(): Promise<SerializedOrganization[]> {
	const rows = await db
		.select(organizationCatalogColumns)
		.from(organizations)
		.where(and(eq(organizations.isActive, true), isNull(organizations.deletedAt)))
		.orderBy(asc(organizations.name));
	return rows.map(serializeOrganization);
}

export async function getOrganizationById(id: string): Promise<SerializedOrganization | null> {
	const rows = await db
		.select(organizationCatalogColumns)
		.from(organizations)
		.where(eq(organizations.id, id))
		.limit(1);
	const row = rows[0];
	return row ? serializeOrganization(row) : null;
}

export async function getProfileOrganizationSnapshot(profileId: string): Promise<SerializedOrganization | null> {
	const rows = await db
		.select(organizationCatalogColumns)
		.from(profiles)
		.innerJoin(organizations, eq(organizations.id, profiles.organizationId))
		.where(eq(profiles.id, profileId))
		.limit(1);
	const row = rows[0];
	return row ? serializeOrganization(row) : null;
}

export async function getActiveTeacherOrganizationSnapshot(
	teacherId: string,
): Promise<SerializedOrganization | null> {
	const rows = await db
		.select(organizationCatalogColumns)
		.from(teacherOrganizationMemberships)
		.innerJoin(organizations, eq(organizations.id, teacherOrganizationMemberships.organizationId))
		.where(
			and(
				eq(teacherOrganizationMemberships.teacherId, teacherId),
				eq(teacherOrganizationMemberships.status, "active"),
			),
		)
		.limit(1);
	const row = rows[0];
	return row ? serializeOrganization(row) : null;
}

export async function countActiveTeacherStudentLinks(teacherId: string): Promise<number> {
	const rows = await db
		.select({ count: count() })
		.from(teacherStudentLinks)
		.where(and(eq(teacherStudentLinks.teacherId, teacherId), eq(teacherStudentLinks.status, "active")));
	return rows[0]?.count ?? 0;
}

/** Students actively linked to an independent teacher via link code (`teacher_student_links`). */
export type TeacherLinkedStudentProfileRow = {
	id: string;
	fullName: string;
	studentLinkCode: string | null;
};

export async function listActiveTeacherLinkedStudentProfiles(
	teacherId: string,
): Promise<TeacherLinkedStudentProfileRow[]> {
	return await db
		.select({
			id: profiles.id,
			fullName: profiles.fullName,
			studentLinkCode: profiles.studentLinkCode,
		})
		.from(teacherStudentLinks)
		.innerJoin(profiles, eq(profiles.id, teacherStudentLinks.studentId))
		.where(
			and(eq(teacherStudentLinks.teacherId, teacherId), eq(teacherStudentLinks.status, "active")),
		)
		.orderBy(asc(profiles.fullName));
}

export type DeactivateOrganizationResult = {
	organization: SerializedOrganizationAdmin;
	studentIds: string[];
	teacherIds: string[];
};

export async function deactivateOrganizationWithCleanup(
	organizationId: string,
): Promise<DeactivateOrganizationResult | null> {
	const now = new Date();

	return db.transaction(async (tx) => {
		const orgRows = await tx
			.select()
			.from(organizations)
			.where(eq(organizations.id, organizationId))
			.limit(1);
		const organization = orgRows[0];
		if (!organization) return null;

		const studentRows = await tx
			.select({ id: profiles.id })
			.from(profiles)
			.where(and(eq(profiles.organizationId, organizationId), eq(profiles.role, "student")));

		const teacherRows = await tx
			.select({ id: teacherOrganizationMemberships.teacherId })
			.from(teacherOrganizationMemberships)
			.where(
				and(
					eq(teacherOrganizationMemberships.organizationId, organizationId),
					eq(teacherOrganizationMemberships.status, "active"),
				),
			);

		const [updated] = await tx
			.update(organizations)
			.set({ isActive: false, deletedAt: now, updatedAt: now })
			.where(eq(organizations.id, organizationId))
			.returning();

		if (studentRows.length > 0) {
			await tx
				.update(profiles)
				.set({ organizationId: null, updatedAt: now })
				.where(and(eq(profiles.organizationId, organizationId), eq(profiles.role, "student")));
		}

		if (teacherRows.length > 0) {
			await tx
				.update(teacherOrganizationMemberships)
				.set({ status: "revoked", revokedAt: now, updatedAt: now })
				.where(
					and(
						eq(teacherOrganizationMemberships.organizationId, organizationId),
						eq(teacherOrganizationMemberships.status, "active"),
					),
				);
		}

		return {
			organization: serializeOrganizationAdmin(updated ?? organization),
			studentIds: studentRows.map((row) => row.id),
			teacherIds: teacherRows.map((row) => row.id),
		};
	});
}

export function organizationInputToDbValues(input: AdminOrganizationInput): {
	type: AdminOrganizationInput["type"];
	name: string;
	externalId: string | null;
	faviconUrl: string | null;
	isActive: boolean;
	updatedAt: Date;
} {
	return {
		type: input.type,
		name: input.name,
		externalId: input.external_id,
		faviconUrl: input.favicon_url,
		isActive: input.is_active,
		updatedAt: new Date(),
	};
}
