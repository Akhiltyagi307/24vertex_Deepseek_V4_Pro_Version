import "server-only";

import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { authUsers } from "@/db/schema/auth-users";
import { subscriptions } from "@/db/schema/billing";
import { profiles } from "@/db/schema/profiles";

export type AdminSubscriptionListParams = {
	page: number;
	pageSize: number;
	status?: string | null;
	q?: string | null;
};

export type AdminSubscriptionListRow = {
	id: string;
	profile_id: string;
	plan_code: string;
	status: string;
	trial_ends_at: Date | null;
	current_period_start: Date;
	current_period_end: Date;
	cancel_at_period_end: boolean;
	razorpay_subscription_id: string | null;
	staff_override: boolean;
	full_name: string;
	email: string | null;
	created_at: Date | null;
	updated_at: Date | null;
};

export async function adminListSubscriptions(
	params: AdminSubscriptionListParams,
): Promise<{ rows: AdminSubscriptionListRow[]; total: number }> {
	const page = Math.max(1, params.page);
	const pageSize = Math.min(250, Math.max(1, params.pageSize));
	const offset = (page - 1) * pageSize;

	const conditions: SQL[] = [];
	const st = params.status?.trim();
	if (st) conditions.push(eq(subscriptions.status, st));
	const q = params.q?.trim();
	if (q) {
		const pattern = `%${q.replace(/%/g, "\\%")}%`;
		conditions.push(
			or(ilike(profiles.fullName, pattern), ilike(authUsers.email, pattern), ilike(subscriptions.planCode, pattern))!,
		);
	}
	const whereSql = conditions.length > 0 ? and(...conditions) : undefined;

	const fromSubs = () =>
		db
			.select({
				id: subscriptions.id,
				profileId: subscriptions.profileId,
				planCode: subscriptions.planCode,
				status: subscriptions.status,
				trialEndsAt: subscriptions.trialEndsAt,
				currentPeriodStart: subscriptions.currentPeriodStart,
				currentPeriodEnd: subscriptions.currentPeriodEnd,
				cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
				razorpaySubscriptionId: subscriptions.razorpaySubscriptionId,
				staffOverride: subscriptions.staffOverride,
				fullName: profiles.fullName,
				email: authUsers.email,
				createdAt: subscriptions.createdAt,
				updatedAt: subscriptions.updatedAt,
			})
			.from(subscriptions)
			.innerJoin(profiles, eq(subscriptions.profileId, profiles.id))
			.leftJoin(authUsers, eq(authUsers.id, profiles.id));

	const rowQuery = whereSql ? fromSubs().where(whereSql) : fromSubs();
	const rawRows = await rowQuery.orderBy(desc(subscriptions.updatedAt)).limit(pageSize).offset(offset);

	const countFrom = () =>
		db
			.select({ total: count() })
			.from(subscriptions)
			.innerJoin(profiles, eq(subscriptions.profileId, profiles.id))
			.leftJoin(authUsers, eq(authUsers.id, profiles.id));
	const [{ total }] = await (whereSql ? countFrom().where(whereSql) : countFrom());

	const rows: AdminSubscriptionListRow[] = rawRows.map((r) => ({
		id: r.id,
		profile_id: r.profileId,
		plan_code: r.planCode,
		status: r.status,
		trial_ends_at: r.trialEndsAt,
		current_period_start: r.currentPeriodStart,
		current_period_end: r.currentPeriodEnd,
		cancel_at_period_end: r.cancelAtPeriodEnd,
		razorpay_subscription_id: r.razorpaySubscriptionId,
		staff_override: r.staffOverride,
		full_name: r.fullName,
		email: r.email,
		created_at: r.createdAt,
		updated_at: r.updatedAt,
	}));

	return { rows, total: Number(total) };
}
