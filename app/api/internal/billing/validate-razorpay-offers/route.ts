import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";

import { db } from "@/db";
import { billingActionFailures, coupons } from "@/db/schema/billing";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { BILLING_ACTION_FAILURE_KINDS } from "@/lib/billing/action-failures";
import { fetchOfferStatus } from "@/lib/billing/razorpay-subscription-offers";
import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * W4.5 — weekly check that Razorpay offers backing checkout-discount
 * coupons still exist + are usable. If Razorpay deleted/disabled an offer
 * server-side, our coupon would silently fail at checkout; this cron
 * disables the coupon proactively and surfaces it for re-sync.
 */
async function handle(request: Request): Promise<Response> {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;

	const rows = await db
		.select({
			id: coupons.id,
			code: coupons.code,
			razorpayOffersByPlan: coupons.razorpayOffersByPlan,
		})
		.from(coupons)
		.where(eq(coupons.kind, "checkout_discount"));

	const targetRows = rows.filter((r) => r.razorpayOffersByPlan && Object.keys(r.razorpayOffersByPlan).length > 0);

	let checked = 0;
	let disabled = 0;
	const errors: Array<{ couponId: string; offerId: string; error: string }> = [];
	const stale: Array<{ couponId: string; couponCode: string; planCode: string; offerId: string; status: string }> = [];

	for (const row of targetRows) {
		const map = row.razorpayOffersByPlan ?? {};
		let everyOk = true;
		for (const [planCode, offerId] of Object.entries(map)) {
			checked += 1;
			try {
				const status = await fetchOfferStatus(offerId);
				if (status !== "active") {
					everyOk = false;
					stale.push({ couponId: row.id, couponCode: row.code, planCode, offerId, status });
				}
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				errors.push({ couponId: row.id, offerId, error: msg });
			}
		}
		if (!everyOk) {
			await db.update(coupons).set({ isActive: false }).where(eq(coupons.id, row.id));
			await db.insert(billingActionFailures).values({
				kind: BILLING_ACTION_FAILURE_KINDS.SYNC_OFFERS_PARTIAL,
				couponId: row.id,
				errorMessage: `Razorpay offer validity check disabled coupon ${row.code} (one or more offers stale).`,
				payload: { stale_offers: stale.filter((s) => s.couponId === row.id) },
			});
			disabled += 1;
		}
	}

	if (disabled > 0 || errors.length > 0) {
		Sentry.captureMessage("billing.offers.validity_check", {
			level: "warning",
			tags: { component: "billing.offers" },
			extra: { checked, disabled, errors_count: errors.length, stale, errors },
		});
		await writeAdminAction({
			action: ADMIN_ACTIONS.BILLING_RECONCILIATION_RUN,
			targetType: "billing",
			payload: { trigger: "offer_validity", checked, disabled, stale, errors },
		});
	}

	return Response.json({ ok: true, checked, disabled, errors: errors.length });
}

export async function POST(request: Request): Promise<Response> {
	return handle(request);
}

export async function GET(request: Request): Promise<Response> {
	return handle(request);
}
