import "server-only";

import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { adminActionLog } from "@/db/schema/admin-action-log";
import { tests } from "@/db/schema/assessment";
import { coupons } from "@/db/schema/billing";
import { profiles } from "@/db/schema/profiles";

export type AdminSearchHitType = "user" | "coupon" | "test" | "audit";

export type AdminSearchHit = {
	type: AdminSearchHitType;
	id: string;
	label: string;
	subtitle?: string;
	href: string;
};

const PER_KIND = 8;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
	return UUID_RE.test(s.trim());
}

function escapeIlike(s: string): string {
	return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function adminGlobalSearch(rawQ: string): Promise<AdminSearchHit[]> {
	const q = rawQ.trim();
	if (q.length < 2) return [];

	const pattern = `%${escapeIlike(q)}%`;
	const hits: AdminSearchHit[] = [];

	const emailSql = sql<string>`(select u.email::text from auth.users u where u.id = ${profiles.id} limit 1)`.as("email");

	// Users (any role): id match or name/email ilike
	if (isUuid(q)) {
		const rows = await db
			.select({
				id: profiles.id,
				fullName: profiles.fullName,
				role: profiles.role,
				email: emailSql,
			})
			.from(profiles)
			.where(eq(profiles.id, q))
			.limit(PER_KIND);
		for (const r of rows) {
			const email = r.email ?? "";
			hits.push({
				type: "user",
				id: r.id,
				label: r.fullName,
				subtitle: `${r.role}${email ? ` · ${email}` : ""}`,
				href: `/admin/users/${r.id}`,
			});
		}
	}
	const userIds = new Set(hits.filter((h) => h.type === "user").map((h) => h.id));
	if (userIds.size < PER_KIND) {
		const whereUser = or(
			ilike(profiles.fullName, pattern),
			ilike(profiles.schoolName, pattern),
			ilike(profiles.parentEmail, pattern),
			sql`(select u.email::text from auth.users u where u.id = ${profiles.id} limit 1) ilike ${pattern}`,
		);
		const rows = await db
			.select({
				id: profiles.id,
				fullName: profiles.fullName,
				role: profiles.role,
				email: emailSql,
			})
			.from(profiles)
			.where(and(isNull(profiles.deletedAt), whereUser!))
			.orderBy(desc(profiles.lastActiveAt))
			.limit(PER_KIND);
		for (const r of rows) {
			if (userIds.has(r.id)) continue;
			userIds.add(r.id);
			const email = r.email ?? "";
			hits.push({
				type: "user",
				id: r.id,
				label: r.fullName,
				subtitle: `${r.role}${email ? ` · ${email}` : ""}`,
				href: `/admin/users/${r.id}`,
			});
		}
	}

	// Coupons by code (and id if uuid)
	if (isUuid(q)) {
		const rows = await db
			.select({ id: coupons.id, code: coupons.code })
			.from(coupons)
			.where(eq(coupons.id, q))
			.limit(PER_KIND);
		for (const r of rows) {
			hits.push({
				type: "coupon",
				id: r.id,
				label: r.code,
				subtitle: "Coupon",
				href: `/admin/billing/coupons`,
			});
		}
	}
	const couponRows = await db
		.select({ id: coupons.id, code: coupons.code })
		.from(coupons)
		.where(ilike(coupons.code, pattern))
		.orderBy(desc(coupons.createdAt))
		.limit(PER_KIND);
	const couponSeen = new Set(hits.filter((h) => h.type === "coupon").map((h) => h.id));
	for (const r of couponRows) {
		if (couponSeen.has(r.id)) continue;
		couponSeen.add(r.id);
		hits.push({
			type: "coupon",
			id: r.id,
			label: r.code,
			subtitle: "Coupon",
			href: `/admin/billing/coupons`,
		});
	}

	// Tests by id
	if (isUuid(q)) {
		const rows = await db
			.select({ id: tests.id, status: tests.status, studentId: tests.studentId })
			.from(tests)
			.where(eq(tests.id, q))
			.limit(PER_KIND);
		for (const r of rows) {
			hits.push({
				type: "test",
				id: r.id,
				label: `Test ${r.id.slice(0, 8)}…`,
				subtitle: r.status ?? "unknown",
				href: `/admin/assessments/tests/${r.id}`,
			});
		}
	}

	// Audit log
	const auditRows = await db
		.select({
			id: adminActionLog.id,
			action: adminActionLog.action,
			targetType: adminActionLog.targetType,
			targetId: adminActionLog.targetId,
			createdAt: adminActionLog.createdAt,
		})
		.from(adminActionLog)
		.where(
			or(
				ilike(adminActionLog.action, pattern),
				sql`${adminActionLog.targetId}::text ilike ${pattern}`,
				ilike(adminActionLog.targetType, pattern),
			)!,
		)
		.orderBy(desc(adminActionLog.createdAt))
		.limit(PER_KIND);
	for (const r of auditRows) {
		const tid = r.targetId ? String(r.targetId) : "";
		const auditQs = new URLSearchParams();
		if (tid) auditQs.set("targetId", tid);
		else auditQs.set("action", r.action);
		if (r.targetType) auditQs.set("targetType", r.targetType);
		hits.push({
			type: "audit",
			id: String(r.id),
			label: r.action,
			subtitle: [r.targetType, tid].filter(Boolean).join(" · ") || undefined,
			href: `/admin/audit?${auditQs.toString()}`,
		});
	}

	const seen = new Set<string>();
	const deduped: AdminSearchHit[] = [];
	for (const h of hits) {
		const k = `${h.type}:${h.id}`;
		if (seen.has(k)) continue;
		seen.add(k);
		deduped.push(h);
	}
	return deduped.slice(0, 40);
}
