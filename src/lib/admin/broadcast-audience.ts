import "server-only";

import { and, count, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { subscriptions } from "@/db/schema/billing";
import { profiles } from "@/db/schema/profiles";

export type BroadcastAudienceJson = {
	kind: "all" | "students" | "parents" | "teachers" | "grade" | "plan";
	grade?: number;
	section?: string;
	stream?: string;
	plan_code?: string;
};

const emailSql = sql<string>`(select u.email::text from auth.users u where u.id = ${profiles.id} limit 1)`.as("email");

function roleClause(kind: BroadcastAudienceJson["kind"]) {
	if (kind === "students") return eq(profiles.role, "student");
	if (kind === "parents") return eq(profiles.role, "parent");
	if (kind === "teachers") return eq(profiles.role, "teacher");
	if (kind === "grade") return eq(profiles.role, "student");
	if (kind === "plan") return eq(profiles.role, "student");
	return or(eq(profiles.role, "student"), eq(profiles.role, "parent"), eq(profiles.role, "teacher"))!;
}

export async function countBroadcastAudience(audience: BroadcastAudienceJson): Promise<number> {
	const base =
		audience.kind === "all"
			? [isNull(profiles.deletedAt), eq(profiles.isSuspended, false)]
			: [isNull(profiles.deletedAt), eq(profiles.isSuspended, false), roleClause(audience.kind)];
	if (audience.kind === "grade" && audience.grade != null && Number.isFinite(audience.grade)) {
		base.push(eq(profiles.grade, audience.grade));
	}
	if (audience.section?.trim()) {
		base.push(eq(profiles.section, audience.section.trim()));
	}
	if (audience.stream?.trim()) {
		base.push(eq(profiles.stream, audience.stream.trim()));
	}

	if (audience.kind === "plan" && audience.plan_code?.trim()) {
		const whereSql = and(
			...base,
			eq(subscriptions.status, "active"),
			eq(subscriptions.planCode, audience.plan_code.trim()),
		);
		const [row] = await db
			.select({ c: count() })
			.from(profiles)
			.innerJoin(subscriptions, eq(subscriptions.profileId, profiles.id))
			.where(whereSql);
		return Number(row?.c ?? 0);
	}

	const whereSql = and(...base);
	const [row] = await db.select({ c: count() }).from(profiles).where(whereSql);
	return Number(row?.c ?? 0);
}

export type BroadcastRecipient = { id: string; email: string | null; role: string };

export async function listBroadcastRecipients(
	audience: BroadcastAudienceJson,
	opts: { limit: number; offset: number },
): Promise<BroadcastRecipient[]> {
	const base =
		audience.kind === "all"
			? [isNull(profiles.deletedAt), eq(profiles.isSuspended, false)]
			: [isNull(profiles.deletedAt), eq(profiles.isSuspended, false), roleClause(audience.kind)];
	if (audience.kind === "grade" && audience.grade != null && Number.isFinite(audience.grade)) {
		base.push(eq(profiles.grade, audience.grade));
	}
	if (audience.section?.trim()) {
		base.push(eq(profiles.section, audience.section.trim()));
	}
	if (audience.stream?.trim()) {
		base.push(eq(profiles.stream, audience.stream.trim()));
	}

	if (audience.kind === "plan" && audience.plan_code?.trim()) {
		const whereSql = and(
			...base,
			eq(subscriptions.status, "active"),
			eq(subscriptions.planCode, audience.plan_code.trim()),
		);
		return db
			.select({
				id: profiles.id,
				email: emailSql,
				role: profiles.role,
			})
			.from(profiles)
			.innerJoin(subscriptions, eq(subscriptions.profileId, profiles.id))
			.where(whereSql)
			.limit(opts.limit)
			.offset(opts.offset);
	}

	const whereSql = and(...base);
	return db
		.select({
			id: profiles.id,
			email: emailSql,
			role: profiles.role,
		})
		.from(profiles)
		.where(whereSql)
		.limit(opts.limit)
		.offset(opts.offset);
}
