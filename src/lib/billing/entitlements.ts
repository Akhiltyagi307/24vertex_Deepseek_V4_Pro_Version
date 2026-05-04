import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerUser } from "@/lib/auth/get-server-user";
import { isSaasEnforcementEnabled } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { consumeNextQuotaTestGrant } from "@/lib/billing/quota-grant-consume";
import { PLAN_CATALOG, type PlanCode, tokenQuotaForGrade } from "@/lib/billing/plans";
import { trialDaysLeftFromEnd } from "@/lib/billing/trial-days";
import { findCurrentUsagePeriod } from "@/lib/billing/usage-period";
import { maybeNotifyUsageThreshold } from "@/lib/notifications/usage-threshold";

export type SubscriptionStatus =
	| "trialing"
	| "active"
	| "coupon"
	| "grace"
	| "past_due"
	| "cancelled"
	| "expired";

export type EntitlementReason =
	| "ok"
	| "trial_expired"
	| "quota_tests"
	| "quota_tokens"
	| "past_due"
	| "cancelled"
	| "expired"
	| "no_subscription";

export type EntitlementSnapshot = {
	profileId: string;
	planCode: PlanCode;
	status: SubscriptionStatus;
	staffOverride: boolean;
	trialEndsAt: string | null;
	currentPeriodStart: string;
	currentPeriodEnd: string;
	cancelAtPeriodEnd: boolean;
	testsQuota: number;
	testsUsed: number;
	testsLeft: number;
	tokensQuota: number;
	tokensUsed: number;
	tokensLeft: number;
	trialDaysLeft: number | null;
	canStartTest: boolean;
	canChatDoubt: boolean;
	reason: EntitlementReason;
	/** `false` when SAAS_ENFORCEMENT=false — useful for UI to show a dev banner. */
	enforcementActive: boolean;
};

type SubscriptionRow = {
	id: string;
	profile_id: string;
	plan_code: PlanCode;
	status: SubscriptionStatus;
	trial_ends_at: string | null;
	current_period_start: string;
	current_period_end: string;
	cancel_at_period_end: boolean;
	razorpay_subscription_id: string | null;
	razorpay_customer_id: string | null;
	pending_plan_code: PlanCode | null;
	staff_override: boolean;
};

type UsageRow = {
	tests_quota: number;
	tests_used: number;
	tokens_quota: number;
	tokens_used: number;
	period_start: string;
	period_end: string;
};

/** RPC payload from {@link get_entitlement_snapshot} (JSON keys snake_case). */
type EntitlementSnapshotRpcRow = {
	subscription_id: string;
	profile_id: string;
	plan_code: PlanCode;
	status: SubscriptionStatus;
	trial_ends_at: string | null;
	current_period_start: string;
	current_period_end: string;
	cancel_at_period_end: boolean;
	razorpay_subscription_id: string | null;
	razorpay_customer_id: string | null;
	pending_plan_code: PlanCode | null;
	staff_override: boolean;
	tests_quota: number;
	tests_used: number;
	tokens_quota: number;
	tokens_used: number;
};

/** Recent periods to scan when falling back to table queries (RPC unavailable). */
const USAGE_PERIOD_LOOKBACK = 48;

/** PostgREST: function not in schema cache (migration not applied yet). */
function isMissingEntitlementSnapshotRpc(error: {
	code?: string;
	message?: string;
}): boolean {
	return (
		error.code === "PGRST202" &&
		(error.message?.includes("get_entitlement_snapshot") ?? false)
	);
}

function daysUntil(iso: string | null): number | null {
	return trialDaysLeftFromEnd(iso);
}

export function deriveReason(args: {
	status: SubscriptionStatus;
	trialEndsAt: string | null;
	periodEnd: string;
	testsLeft: number;
	tokensLeft: number;
}): { reason: EntitlementReason; canStartTest: boolean; canChatDoubt: boolean } {
	const now = Date.now();
	const periodExpired = new Date(args.periodEnd).getTime() <= now;

	if (args.status === "expired" || args.status === "cancelled" || periodExpired) {
		return { reason: args.status === "cancelled" ? "cancelled" : "expired", canStartTest: false, canChatDoubt: false };
	}
	if (args.status === "past_due") {
		return { reason: "past_due", canStartTest: false, canChatDoubt: false };
	}
	// `grace`: payment retry window — keep access while quotas last; banner warns via `status === "grace"`.
	if (args.status === "trialing" && args.trialEndsAt && new Date(args.trialEndsAt).getTime() <= now) {
		return { reason: "trial_expired", canStartTest: false, canChatDoubt: false };
	}
	return {
		reason: args.testsLeft <= 0 ? "quota_tests" : args.tokensLeft <= 0 ? "quota_tokens" : "ok",
		canStartTest: args.testsLeft > 0,
		canChatDoubt: args.tokensLeft > 0,
	};
}

function syntheticFreeTierSnapshot(profileId: string): EntitlementSnapshot {
	const plan = PLAN_CATALOG.free;
	return {
		profileId,
		planCode: "free",
		status: "trialing",
		staffOverride: false,
		trialEndsAt: null,
		currentPeriodStart: new Date().toISOString(),
		currentPeriodEnd: new Date().toISOString(),
		cancelAtPeriodEnd: false,
		testsQuota: plan.testsPerPeriod,
		testsUsed: 0,
		testsLeft: plan.testsPerPeriod,
		tokensQuota: plan.tokensGrade6to10,
		tokensUsed: 0,
		tokensLeft: plan.tokensGrade6to10,
		trialDaysLeft: 14,
		canStartTest: true,
		canChatDoubt: true,
		reason: "ok",
		enforcementActive: isSaasEnforcementEnabled(),
	};
}

export function buildEntitlementSnapshot(args: {
	profileId: string;
	planCode: PlanCode;
	status: SubscriptionStatus;
	staffOverride: boolean;
	trialEndsAt: string | null;
	currentPeriodStart: string;
	currentPeriodEnd: string;
	cancelAtPeriodEnd: boolean;
	testsQuota: number;
	testsUsed: number;
	tokensQuota: number;
	tokensUsed: number;
}): EntitlementSnapshot {
	const periodExpired = new Date(args.currentPeriodEnd).getTime() <= Date.now();
	const effectiveStatus: SubscriptionStatus =
		periodExpired && args.status !== "cancelled" && args.status !== "expired" ? "expired" : args.status;
	const testsLeft = Math.max(0, args.testsQuota - args.testsUsed);
	const tokensLeft = Math.max(0, args.tokensQuota - args.tokensUsed);
	const { reason, canStartTest, canChatDoubt } = deriveReason({
		status: effectiveStatus,
		trialEndsAt: args.trialEndsAt,
		periodEnd: args.currentPeriodEnd,
		testsLeft,
		tokensLeft,
	});
	const enforcementActive = isSaasEnforcementEnabled();
	const finalCanStartTest = args.staffOverride || !enforcementActive ? true : canStartTest;
	const finalCanChatDoubt = args.staffOverride || !enforcementActive ? true : canChatDoubt;

	return {
		profileId: args.profileId,
		planCode: args.planCode,
		status: effectiveStatus,
		staffOverride: args.staffOverride,
		trialEndsAt: args.trialEndsAt,
		currentPeriodStart: args.currentPeriodStart,
		currentPeriodEnd: args.currentPeriodEnd,
		cancelAtPeriodEnd: args.cancelAtPeriodEnd,
		testsQuota: args.testsQuota,
		testsUsed: args.testsUsed,
		testsLeft,
		tokensQuota: args.tokensQuota,
		tokensUsed: args.tokensUsed,
		tokensLeft,
		trialDaysLeft: effectiveStatus === "trialing" ? daysUntil(args.trialEndsAt) : null,
		canStartTest: finalCanStartTest,
		canChatDoubt: finalCanChatDoubt,
		reason,
		enforcementActive,
	};
}

function parseEntitlementRpcPayload(raw: unknown): EntitlementSnapshotRpcRow | null {
	if (!raw || typeof raw !== "object") return null;
	const o = raw as Record<string, unknown>;
	const planCode = o.plan_code;
	if (typeof planCode !== "string" || !(planCode in PLAN_CATALOG)) return null;
	const status = o.status;
	if (typeof status !== "string") return null;
	return {
		subscription_id: String(o.subscription_id ?? ""),
		profile_id: String(o.profile_id ?? ""),
		plan_code: planCode as PlanCode,
		status: status as SubscriptionStatus,
		trial_ends_at: (o.trial_ends_at as string | null) ?? null,
		current_period_start: String(o.current_period_start ?? ""),
		current_period_end: String(o.current_period_end ?? ""),
		cancel_at_period_end: Boolean(o.cancel_at_period_end),
		razorpay_subscription_id: (o.razorpay_subscription_id as string | null) ?? null,
		razorpay_customer_id: (o.razorpay_customer_id as string | null) ?? null,
		pending_plan_code: (o.pending_plan_code as PlanCode | null) ?? null,
		staff_override: Boolean(o.staff_override),
		tests_quota: Number(o.tests_quota ?? 0),
		tests_used: Number(o.tests_used ?? 0),
		tokens_quota: Number(o.tokens_quota ?? 0),
		tokens_used: Number(o.tokens_used ?? 0),
	};
}

/** Fallback when `get_entitlement_snapshot` is missing or errors (e.g. migration not applied). */
async function loadEntitlementsFromTables(
	supabase: SupabaseClient,
	profileId: string,
): Promise<EntitlementSnapshot | null> {
	const { data: sub, error: subErr } = await supabase
		.from("subscriptions")
		.select(
			"id, profile_id, plan_code, status, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end, razorpay_subscription_id, razorpay_customer_id, pending_plan_code, staff_override",
		)
		.eq("profile_id", profileId)
		.maybeSingle<SubscriptionRow>();

	if (subErr) {
		logSupabaseError("billing.getEntitlements.subscription", subErr, { profileId });
	}

	if (!sub) {
		return syntheticFreeTierSnapshot(profileId);
	}

	const nowMs = Date.now();
	const { data: usageRows, error: usageErr } = await supabase
		.from("usage_periods")
		.select("tests_quota, tests_used, tokens_quota, tokens_used, period_start, period_end")
		.eq("subscription_id", sub.id)
		.order("period_end", { ascending: false })
		.limit(USAGE_PERIOD_LOOKBACK);

	if (usageErr) {
		logSupabaseError("billing.getEntitlements.usage_periods", usageErr, {
			profileId,
			subscriptionId: sub.id,
		});
	}

	const isActiveWindow = (r: UsageRow) => {
		const start = new Date(r.period_start).getTime();
		const end = new Date(r.period_end).getTime();
		return start <= nowMs && end > nowMs;
	};

	let usage: UsageRow | null = null;
	if (usageRows?.length) {
		usage = usageRows.find(isActiveWindow) ?? usageRows[0] ?? null;
	}

	return buildEntitlementSnapshot({
		profileId,
		planCode: sub.plan_code,
		status: sub.status,
		staffOverride: sub.staff_override,
		trialEndsAt: sub.trial_ends_at,
		currentPeriodStart: sub.current_period_start,
		currentPeriodEnd: sub.current_period_end,
		cancelAtPeriodEnd: sub.cancel_at_period_end,
		testsQuota: usage?.tests_quota ?? 0,
		testsUsed: usage?.tests_used ?? 0,
		tokensQuota: usage?.tokens_quota ?? 0,
		tokensUsed: usage?.tokens_used ?? 0,
	});
}

/**
 * Loads the full entitlement snapshot for a profile. Safe to call from server
 * components + actions; uses the caller's Supabase client (RLS returns only
 * that student's own rows).
 *
 * Prefers `get_entitlement_snapshot` (one round trip); falls back to table
 * queries if the RPC is unavailable.
 *
 * When `SAAS_ENFORCEMENT=false` we still compute the snapshot (so UI meters
 * stay accurate) but force `canStartTest` + `canChatDoubt` to `true`.
 */
export async function getEntitlements(
	supabase: SupabaseClient,
	profileId: string,
): Promise<EntitlementSnapshot | null> {
	const { data: raw, error: rpcErr } = await supabase.rpc("get_entitlement_snapshot", {
		p_profile_id: profileId,
	});

	if (!rpcErr) {
		if (raw === null) {
			return syntheticFreeTierSnapshot(profileId);
		}
		const row = parseEntitlementRpcPayload(raw);
		if (!row?.profile_id || row.profile_id !== profileId) {
			return loadEntitlementsFromTables(supabase, profileId);
		}
		return buildEntitlementSnapshot({
			profileId,
			planCode: row.plan_code,
			status: row.status,
			staffOverride: row.staff_override,
			trialEndsAt: row.trial_ends_at,
			currentPeriodStart: row.current_period_start,
			currentPeriodEnd: row.current_period_end,
			cancelAtPeriodEnd: row.cancel_at_period_end,
			testsQuota: row.tests_quota,
			testsUsed: row.tests_used,
			tokensQuota: row.tokens_quota,
			tokensUsed: row.tokens_used,
		});
	}

	// Expected until `20260424120000_get_entitlement_snapshot.sql` is applied; we fall back below.
	if (!isMissingEntitlementSnapshotRpc(rpcErr)) {
		logSupabaseError("billing.getEntitlements.rpc", rpcErr, { profileId });
	}
	return loadEntitlementsFromTables(supabase, profileId);
}

/**
 * One `getEntitlements` per RSC request (layout + /student/subscription, etc. share a single result).
 */
export const getCachedEntitlements = cache(async (): Promise<EntitlementSnapshot | null> => {
	const user = await getServerUser();
	if (!user) return null;
	const supabase = await createClient();
	return getEntitlements(supabase, user.id);
});

/**
 * Entitlements for an arbitrary profile (e.g. parent's active child). Callers must enforce access control.
 */
export const getCachedEntitlementsForProfile = cache(async (profileId: string): Promise<EntitlementSnapshot | null> => {
	const supabase = await createClient();
	return getEntitlements(supabase, profileId);
});

export type ConsumeResult =
	| { ok: true }
	| { ok: false; code: "quota_tests" | "quota_tokens" | "trial_expired" | "expired" | "no_subscription"; message: string };

const QUOTA_TEST_MESSAGE = "You've used all the tests included in your current plan.";
const QUOTA_TOKEN_MESSAGE =
	"You've used all the AI output tokens included in your current plan for doubt chat.";

async function evaluatePracticeTestBilling(
	supabase: SupabaseClient,
	profileId: string,
): Promise<ConsumeResult> {
	const snapshot = await getEntitlements(supabase, profileId);
	if (!snapshot) return { ok: false, code: "no_subscription", message: "No active subscription." };
	if (snapshot.staffOverride) return { ok: true };

	if (snapshot.reason === "trial_expired") {
		return { ok: false, code: "trial_expired", message: "Your free trial has ended." };
	}
	if (snapshot.reason === "expired" || snapshot.reason === "cancelled" || snapshot.reason === "past_due") {
		return { ok: false, code: "expired", message: "Your subscription is not active." };
	}
	if (snapshot.testsLeft <= 0) {
		return { ok: false, code: "quota_tests", message: QUOTA_TEST_MESSAGE };
	}
	return { ok: true };
}

/**
 * Quota + subscription gate **without** incrementing usage. Call before expensive
 * AI work; call {@link consumeTest} only after the practice test is persisted.
 */
export async function preflightPracticeTestQuota(
	supabase: SupabaseClient,
	profileId: string,
): Promise<ConsumeResult> {
	if (!isSaasEnforcementEnabled()) return { ok: true };
	return evaluatePracticeTestBilling(supabase, profileId);
}

/**
 * Atomically increments the practice-test meter for the current usage period.
 * When enforcement is off or the student has a staff override, skips the RPC.
 */
export async function consumeTest(
	supabase: SupabaseClient,
	profileId: string,
): Promise<ConsumeResult> {
	if (!isSaasEnforcementEnabled()) return { ok: true };

	const gate = await evaluatePracticeTestBilling(supabase, profileId);
	if (!gate.ok) return gate;

	if (await consumeNextQuotaTestGrant(profileId)) {
		return { ok: true };
	}

	const { data, error } = await supabase.rpc("billing_consume_test", { p_profile_id: profileId });
	if (error) {
		logSupabaseError("billing.consume_test.rpc", error, { profileId });
		// Fail-open in case of infra error; rate-limit still applies.
		return { ok: true };
	}
	if (data === false) {
		return { ok: false, code: "quota_tests", message: QUOTA_TEST_MESSAGE };
	}

	// Fire-and-forget: 80% / 100% usage notifications. We re-read the
	// subscription's active usage_periods row because `billing_consume_test`
	// only returns a boolean; mirrors the window rule used in
	// `get_entitlement_snapshot`.
	void emitTestsUsageThresholdIfAny(supabase, profileId);

	return { ok: true };
}

async function emitTestsUsageThresholdIfAny(_supabase: SupabaseClient, profileId: string): Promise<void> {
	try {
		const period = await findCurrentUsagePeriod(profileId);
		if (!period) return;
		await maybeNotifyUsageThreshold({
			profileId,
			usagePeriodId: period.id,
			meter: "tests",
			testsUsed: period.testsUsed,
			testsQuota: period.testsQuota,
		});
	} catch (err) {
		// Helper already logs; extra catch here so bad data never surfaces to
		// the grading caller.
		logSupabaseError("billing.consume_test.notify_threshold", { message: String(err) }, { profileId });
	}
}

/**
 * Records **output** (completion) token usage from doubt-chat `onFinish`. Does
 * NOT block: the gate for a *new* turn is `getEntitlements().canChatDoubt` at
 * request start. Quotas in `usage_periods` are defined as output tokens.
 */
export async function consumeTokens(
	supabase: SupabaseClient,
	profileId: string,
	tokens: number,
): Promise<void> {
	if (!isSaasEnforcementEnabled()) return;
	if (!tokens || tokens <= 0) return;
	const { error } = await supabase.rpc("billing_consume_tokens", {
		p_profile_id: profileId,
		p_tokens: tokens,
	});
	if (error) {
		logSupabaseError("billing.consume_tokens.rpc", error, { profileId, tokens });
		return;
	}
	// Fire-and-forget: 80% / 100% usage notifications for doubt-chat tokens.
	void emitTokensUsageThresholdIfAny(supabase, profileId);
}

async function emitTokensUsageThresholdIfAny(
	_supabase: SupabaseClient,
	profileId: string,
): Promise<void> {
	try {
		const period = await findCurrentUsagePeriod(profileId);
		if (!period) return;
		await maybeNotifyUsageThreshold({
			profileId,
			usagePeriodId: period.id,
			meter: "tokens",
			tokensUsed: period.tokensUsed,
			tokensQuota: period.tokensQuota,
		});
	} catch (err) {
		logSupabaseError("billing.consume_tokens.notify_threshold", { message: String(err) }, { profileId });
	}
}

/**
 * Upstream gate for the doubt-chat route. Returns `{ ok: false }` so the
 * caller can respond 402/403 with a paywall payload.
 */
export async function canStartDoubtChat(
	supabase: SupabaseClient,
	profileId: string,
): Promise<ConsumeResult> {
	if (!isSaasEnforcementEnabled()) return { ok: true };
	const snapshot = await getEntitlements(supabase, profileId);
	if (!snapshot) return { ok: false, code: "no_subscription", message: "No active subscription." };
	if (snapshot.staffOverride) return { ok: true };
	if (snapshot.reason === "trial_expired") {
		return { ok: false, code: "trial_expired", message: "Your free trial has ended." };
	}
	if (snapshot.reason === "expired" || snapshot.reason === "cancelled" || snapshot.reason === "past_due") {
		return { ok: false, code: "expired", message: "Your subscription is not active." };
	}
	if (snapshot.tokensLeft <= 0) {
		return { ok: false, code: "quota_tokens", message: QUOTA_TOKEN_MESSAGE };
	}
	return { ok: true };
}

/**
 * Close the current usage period and open the next when the billing clock has
 * ticked past `current_period_end`. Intended for webhook handlers (e.g. `subscription.charged`).
 *
 * Idempotent: if a row for the new period already exists, it is skipped.
 */
export async function rolloverPeriodIfNeeded(
	supabase: SupabaseClient,
	profileId: string,
	opts: { studentGrade: number | null; nextPeriodEndIso?: string },
): Promise<void> {
	const { data: sub } = await supabase
		.from("subscriptions")
		.select("id, plan_code, current_period_end")
		.eq("profile_id", profileId)
		.maybeSingle<{ id: string; plan_code: PlanCode; current_period_end: string }>();
	if (!sub) return;

	const now = Date.now();
	const currentEnd = new Date(sub.current_period_end).getTime();
	if (currentEnd > now) return;

	const plan = PLAN_CATALOG[sub.plan_code];
	const newStart = new Date(currentEnd).toISOString();
	const newEnd = opts.nextPeriodEndIso
		? opts.nextPeriodEndIso
		: (() => {
			const d = new Date(currentEnd);
			if (plan.interval === "year") d.setUTCFullYear(d.getUTCFullYear() + 1);
			else d.setUTCMonth(d.getUTCMonth() + 1);
			return d.toISOString();
		})();

	await supabase
		.from("subscriptions")
		.update({ current_period_start: newStart, current_period_end: newEnd, updated_at: new Date().toISOString() })
		.eq("id", sub.id);

	await supabase.from("usage_periods").upsert(
		{
			subscription_id: sub.id,
			profile_id: profileId,
			period_start: newStart,
			period_end: newEnd,
			tests_quota: plan.testsPerPeriod,
			tests_used: 0,
			tokens_quota: tokenQuotaForGrade(plan, opts.studentGrade),
			tokens_used: 0,
		},
		{ onConflict: "subscription_id,period_start" },
	);
}
