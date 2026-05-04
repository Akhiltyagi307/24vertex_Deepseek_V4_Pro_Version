import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { authUsers } from "@/db/schema/auth-users";
import { plans, subscriptions, usagePeriods } from "@/db/schema/billing";
import { profiles } from "@/db/schema/profiles";

export type AdminSubscriptionUsagePeriodRow = {
	id: string;
	period_start: string;
	period_end: string;
	tests_quota: number;
	tests_used: number;
	tokens_quota: number;
	tokens_used: number;
};

export type AdminSubscriptionDetail = {
	subscription: {
		id: string;
		profile_id: string;
		plan_code: string;
		status: string;
		trial_ends_at: Date | null;
		current_period_start: Date;
		current_period_end: Date;
		cancel_at_period_end: boolean;
		razorpay_subscription_id: string | null;
		razorpay_customer_id: string | null;
		pending_plan_code: string | null;
		staff_override: boolean;
		metadata: unknown;
		created_at: Date | null;
		updated_at: Date | null;
	};
	profile: { full_name: string; role: string };
	email: string | null;
	plan_name: string;
	usage_periods: AdminSubscriptionUsagePeriodRow[];
};

export async function adminGetSubscriptionById(subscriptionId: string): Promise<AdminSubscriptionDetail | null> {
	const row = await db
		.select({
			sub: subscriptions,
			fullName: profiles.fullName,
			role: profiles.role,
			email: authUsers.email,
			planName: plans.name,
		})
		.from(subscriptions)
		.innerJoin(profiles, eq(subscriptions.profileId, profiles.id))
		.leftJoin(authUsers, eq(authUsers.id, profiles.id))
		.innerJoin(plans, eq(subscriptions.planCode, plans.code))
		.where(eq(subscriptions.id, subscriptionId))
		.limit(1);

	const first = row[0];
	if (!first) return null;

	const periods = await db
		.select()
		.from(usagePeriods)
		.where(eq(usagePeriods.subscriptionId, subscriptionId))
		.orderBy(desc(usagePeriods.periodEnd))
		.limit(36);

	const s = first.sub;
	return {
		subscription: {
			id: s.id,
			profile_id: s.profileId,
			plan_code: s.planCode,
			status: s.status,
			trial_ends_at: s.trialEndsAt,
			current_period_start: s.currentPeriodStart,
			current_period_end: s.currentPeriodEnd,
			cancel_at_period_end: s.cancelAtPeriodEnd,
			razorpay_subscription_id: s.razorpaySubscriptionId,
			razorpay_customer_id: s.razorpayCustomerId,
			pending_plan_code: s.pendingPlanCode,
			staff_override: s.staffOverride,
			metadata: s.metadata,
			created_at: s.createdAt,
			updated_at: s.updatedAt,
		},
		profile: { full_name: first.fullName, role: first.role },
		email: first.email,
		plan_name: first.planName,
		usage_periods: periods.map((p) => ({
			id: p.id,
			period_start: p.periodStart.toISOString(),
			period_end: p.periodEnd.toISOString(),
			tests_quota: p.testsQuota,
			tests_used: p.testsUsed,
			tokens_quota: p.tokensQuota,
			tokens_used: p.tokensUsed,
		})),
	};
}
