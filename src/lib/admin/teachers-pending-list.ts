import "server-only";

import { and, asc, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema/profiles";

export type PendingTeacherRow = {
	id: string;
	email: string | null;
	full_name: string;
	phone: string | null;
	school_name: string | null;
	created_at: string | null;
};

export async function adminListPendingTeachers(): Promise<PendingTeacherRow[]> {
	const emailSql = sql<string>`(select u.email::text from auth.users u where u.id = ${profiles.id} limit 1)`.as("email");

	const rows = await db
		.select({
			id: profiles.id,
			email: emailSql,
			full_name: profiles.fullName,
			phone: profiles.phone,
			school_name: profiles.schoolName,
			created_at: profiles.createdAt,
		})
		.from(profiles)
		.where(
			and(
				eq(profiles.role, "teacher"),
				or(eq(profiles.isVerified, false), isNull(profiles.isVerified)),
				isNull(profiles.deletedAt),
			),
		)
		.orderBy(asc(profiles.createdAt));

	return rows.map((r) => ({
		id: r.id,
		email: r.email,
		full_name: r.full_name,
		phone: r.phone,
		school_name: r.school_name,
		created_at: r.created_at instanceof Date ? r.created_at.toISOString() : (r.created_at ?? null),
	}));
}
