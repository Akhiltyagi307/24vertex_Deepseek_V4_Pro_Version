import { and, eq, isNotNull, lt } from "drizzle-orm";

import { db } from "@/db";
import { coupons } from "@/db/schema/billing";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * W3.1 — daily disabling of expired coupons.
 *
 * Without this, a coupon with expires_at in the past stays is_active=true and
 * keeps cluttering admin lists. The redeem RPCs already reject such coupons
 * at runtime, so this is hygiene rather than a correctness fix — but admins
 * shouldn't have to mentally filter out stale rows.
 */
async function handle(request: Request): Promise<Response> {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;

	const disabled = await db
		.update(coupons)
		.set({ isActive: false })
		.where(and(eq(coupons.isActive, true), isNotNull(coupons.expiresAt), lt(coupons.expiresAt, new Date())))
		.returning({ code: coupons.code, id: coupons.id });

	if (disabled.length > 0) {
		await writeAdminAction({
			action: ADMIN_ACTIONS.COUPON_AUTO_EXPIRED,
			targetType: "coupon",
			payload: { count: disabled.length, codes: disabled.map((d) => d.code) },
		});
	}

	return Response.json({ ok: true, disabled: disabled.length });
}

export async function POST(request: Request): Promise<Response> {
	return handle(request);
}

export async function GET(request: Request): Promise<Response> {
	return handle(request);
}
