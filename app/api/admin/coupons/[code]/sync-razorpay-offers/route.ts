import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { billingActionFailures, coupons, plans } from "@/db/schema/billing";
import { PAID_CHECKOUT_PLAN_CODES, type PlanCode } from "@/lib/billing/plans";
import { BILLING_ACTION_FAILURE_KINDS } from "@/lib/billing/action-failures";
import { createSubscriptionPercentOffer } from "@/lib/billing/razorpay-subscription-offers";
import { logServerError } from "@/lib/server/log-supabase-error";

export const runtime = "nodejs";

function normalizeCouponParam(raw: string): string {
	return decodeURIComponent(raw).trim().toUpperCase();
}

/** Creates Razorpay subscription offers per eligible paid plan and stores `razorpay_offers_by_plan`. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const code = normalizeCouponParam((await ctx.params).code);
		if (!code) return adminErrorResponse("Invalid code");

		const rows = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
		const row = rows[0];
		if (!row) return adminErrorResponse("Not found", { status: 404 });
		if (row.kind !== "checkout_discount") {
			return adminErrorResponse("Only checkout_discount coupons can sync Razorpay offers.");
		}
		const pct = row.discountPercent;
		if (pct == null || pct < 1 || pct > 100) {
			return adminErrorResponse("Coupon discount_percent is invalid.");
		}

		const eligible: PlanCode[] = row.eligiblePlanCodes?.length
			? row.eligiblePlanCodes.filter((c): c is PlanCode => PAID_CHECKOUT_PLAN_CODES.includes(c as PlanCode))
			: [...PAID_CHECKOUT_PLAN_CODES];
		if (eligible.length === 0) {
			return adminErrorResponse("No eligible paid plans for this coupon.");
		}

		const targets = await db
			.select({ code: plans.code, razorpayPlanId: plans.razorpayPlanId, interval: plans.interval })
			.from(plans)
			.where(inArray(plans.code, eligible));

		// W3.4: all-or-nothing rollback strategy. Razorpay does not let us
		// delete offers, so true rollback is impossible — we change the
		// strategy: try every plan, persist the map ONLY if everything
		// succeeded; on any failure, write the orphan offer ids to
		// billing_action_failures so an admin can reuse them next attempt
		// (passing them via a retry route in the future) and return 502.
		const baseMap: Record<string, string> = { ...(row.razorpayOffersByPlan ?? {}) };
		const newlyCreated: Record<string, string> = {};
		const failures: Array<{ planCode: string; error: string }> = [];

		for (const p of targets) {
			if (!p.razorpayPlanId) {
				failures.push({ planCode: p.code, error: "no razorpay_plan_id; seed Razorpay plans first" });
				continue;
			}
			try {
				const created = await createSubscriptionPercentOffer({
					name: `${row.code} ${pct}% · ${p.code}`,
					razorpayPlanId: p.razorpayPlanId,
					percentOff: pct,
					planInterval: p.interval,
				});
				newlyCreated[p.code] = created.id;
			} catch (e) {
				logServerError("admin.coupon.sync_rzp_offer", e, { planCode: p.code });
				failures.push({ planCode: p.code, error: e instanceof Error ? e.message : String(e) });
			}
		}

		if (failures.length > 0) {
			// Razorpay won't let us delete the orphan offers. Persist them in
			// billing_action_failures with kind=sync_offers_partial so an admin
			// can identify them in the dashboard for cleanup or future reuse.
			// We deliberately do NOT update razorpay_offers_by_plan — the
			// coupon stays "not synced" so it will be rejected at checkout
			// rather than half-applying for one plan and not the other.
			await db.insert(billingActionFailures).values({
				kind: BILLING_ACTION_FAILURE_KINDS.SYNC_OFFERS_PARTIAL,
				couponId: row.id,
				errorMessage: `Razorpay offer sync partial for coupon ${row.code}: failed plans ${failures
					.map((f) => f.planCode)
					.join(", ")}`,
				payload: { failures, orphan_offers: newlyCreated, attempted_plans: targets.map((t) => t.code) },
			});

			Sentry.captureMessage("billing.coupon.sync_offers_partial_failure", {
				level: "warning",
				tags: { component: "billing.coupon" },
				extra: { code: row.code, failures, orphan_offers: newlyCreated },
			});

			return adminErrorResponse(
				`Razorpay offer sync failed for ${failures.length} of ${targets.length} plans. The successful offers are recorded in billing_action_failures (kind=sync_offers_partial) so they can be reused. The coupon is NOT linked to Razorpay until every eligible plan succeeds.`,
				{
					status: 502,
					details: { failures, orphan_offers: newlyCreated },
				},
			);
		}

		const finalMap = { ...baseMap, ...newlyCreated };
		await db.update(coupons).set({ razorpayOffersByPlan: finalMap }).where(eq(coupons.id, row.id));

		// Strict audit: each iteration above mutated Razorpay (created an
		// offer). Missing audit row leaves us unable to attribute who created
		// which offer.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.COUPON_SYNC_RAZORPAY_OFFERS,
			targetType: "coupon",
			targetId: row.id,
			payload: { code: row.code, plan_codes: Object.keys(finalMap) },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse({ razorpay_offers_by_plan: finalMap });
	});
}
