import "server-only";

import {
	and,
	asc,
	count,
	desc,
	eq,
	ilike,
	isNull,
	or,
	type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { authUsers } from "@/db/schema/auth-users";
import { profiles } from "@/db/schema/profiles";

export type AdminUserListRole = "student" | "parent" | "teacher";

export type AdminUserListRow = {
	id: string;
	email: string | null;
	full_name: string;
	role: string;
	grade: number | null;
	section: string | null;
	stream: string | null;
	is_verified: boolean | null;
	is_suspended: boolean;
	deleted_at: string | null;
	last_active_at: string | null;
	created_at: string | null;
};

/** Profile row for `/admin/users/[id]` (L2 fields beyond directory lists). */
export type AdminUserDetailRow = AdminUserListRow & {
	suspended_reason: string | null;
	suspended_at: string | null;
	phone: string | null;
	school_name: string | null;
};

export type AdminUserListParams = {
	role: AdminUserListRole;
	q?: string | null;
	grade?: number | null;
	section?: string | null;
	stream?: string | null;
	includeDeleted?: boolean;
	includeSuspended?: boolean;
	page: number;
	pageSize: number;
	sort?: string | null;
};

function orderClause(sort: string | null | undefined): SQL {
	if (sort === "created_at_asc") return asc(profiles.createdAt);
	if (sort === "name_asc") return asc(profiles.fullName);
	if (sort === "name_desc") return desc(profiles.fullName);
	return desc(profiles.lastActiveAt);
}

export async function adminListUsers(params: AdminUserListParams): Promise<{ rows: AdminUserListRow[]; total: number }> {
	const page = Math.max(1, params.page);
	const pageSize = Math.min(250, Math.max(1, params.pageSize));
	const offset = (page - 1) * pageSize;

	const conditions: SQL[] = [eq(profiles.role, params.role)];
	if (!params.includeDeleted) {
		conditions.push(isNull(profiles.deletedAt));
	}
	if (!params.includeSuspended) {
		conditions.push(eq(profiles.isSuspended, false));
	}
	if (params.grade != null && Number.isFinite(params.grade)) {
		conditions.push(eq(profiles.grade, params.grade));
	}
	if (params.section?.trim()) {
		conditions.push(eq(profiles.section, params.section.trim()));
	}
	if (params.stream?.trim()) {
		conditions.push(eq(profiles.stream, params.stream.trim()));
	}
	const q = params.q?.trim();
	if (q) {
		const pattern = `%${q.replace(/%/g, "\\%")}%`;
		conditions.push(
			or(
				ilike(profiles.fullName, pattern),
				ilike(profiles.schoolName, pattern),
				ilike(profiles.parentEmail, pattern),
				ilike(authUsers.email, pattern),
			)!,
		);
	}

	const whereSql = and(...conditions);

	// Single LEFT JOIN auth.users replaces the previous correlated subquery
	// inside SELECT and WHERE — was running 500+ subquery evaluations per page
	// of 250 rows. The JOIN is 1:1 (profiles.id references auth.users.id) so
	// cardinality is unchanged.
	const [countRow] = await db
		.select({ c: count() })
		.from(profiles)
		.leftJoin(authUsers, eq(authUsers.id, profiles.id))
		.where(whereSql);
	const total = Number(countRow?.c ?? 0);

	const rows = await db
		.select({
			id: profiles.id,
			email: authUsers.email,
			full_name: profiles.fullName,
			role: profiles.role,
			grade: profiles.grade,
			section: profiles.section,
			stream: profiles.stream,
			is_verified: profiles.isVerified,
			is_suspended: profiles.isSuspended,
			deleted_at: profiles.deletedAt,
			last_active_at: profiles.lastActiveAt,
			created_at: profiles.createdAt,
		})
		.from(profiles)
		.leftJoin(authUsers, eq(authUsers.id, profiles.id))
		.where(whereSql)
		.orderBy(orderClause(params.sort))
		.limit(pageSize)
		.offset(offset);

	return {
		total,
		rows: rows.map((r) => ({
			id: r.id,
			email: r.email,
			full_name: r.full_name,
			role: r.role,
			grade: r.grade,
			section: r.section,
			stream: r.stream,
			is_verified: r.is_verified,
			is_suspended: r.is_suspended,
			deleted_at: r.deleted_at instanceof Date ? r.deleted_at.toISOString() : (r.deleted_at ?? null),
			last_active_at: r.last_active_at instanceof Date ? r.last_active_at.toISOString() : (r.last_active_at ?? null),
			created_at: r.created_at instanceof Date ? r.created_at.toISOString() : (r.created_at ?? null),
		})),
	};
}

export async function adminGetUserById(id: string): Promise<AdminUserDetailRow | null> {
	const rows = await db
		.select({
			id: profiles.id,
			email: authUsers.email,
			full_name: profiles.fullName,
			role: profiles.role,
			grade: profiles.grade,
			section: profiles.section,
			stream: profiles.stream,
			is_verified: profiles.isVerified,
			is_suspended: profiles.isSuspended,
			suspended_reason: profiles.suspendedReason,
			suspended_at: profiles.suspendedAt,
			phone: profiles.phone,
			school_name: profiles.schoolName,
			deleted_at: profiles.deletedAt,
			last_active_at: profiles.lastActiveAt,
			created_at: profiles.createdAt,
		})
		.from(profiles)
		.leftJoin(authUsers, eq(authUsers.id, profiles.id))
		.where(eq(profiles.id, id))
		.limit(1);
	const r = rows[0];
	if (!r) return null;
	return {
		id: r.id,
		email: r.email,
		full_name: r.full_name,
		role: r.role,
		grade: r.grade,
		section: r.section,
		stream: r.stream,
		is_verified: r.is_verified,
		is_suspended: r.is_suspended,
		suspended_reason: r.suspended_reason,
		suspended_at: r.suspended_at instanceof Date ? r.suspended_at.toISOString() : (r.suspended_at ?? null),
		phone: r.phone,
		school_name: r.school_name,
		deleted_at: r.deleted_at instanceof Date ? r.deleted_at.toISOString() : (r.deleted_at ?? null),
		last_active_at: r.last_active_at instanceof Date ? r.last_active_at.toISOString() : (r.last_active_at ?? null),
		created_at: r.created_at instanceof Date ? r.created_at.toISOString() : (r.created_at ?? null),
	};
}
