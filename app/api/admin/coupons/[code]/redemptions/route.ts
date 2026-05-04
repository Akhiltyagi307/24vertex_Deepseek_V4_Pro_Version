import { count, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { authUsers } from "@/db/schema/auth-users";
import { couponRedemptions, coupons } from "@/db/schema/billing";
import { profiles } from "@/db/schema/profiles";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

function normalizeCouponParam(raw: string): string {
	return decodeURIComponent(raw).trim().toUpperCase();
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const code = normalizeCouponParam((await ctx.params).code);
		if (!code) {
			return NextResponse.json({ error: "Invalid code" }, { status: 400, headers: adminHeaders() });
		}

		const cRows = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.code, code)).limit(1);
		const coupon = cRows[0];
		if (!coupon) return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });

		const sp = request.nextUrl.searchParams;
		const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
		const pageSize = Math.min(200, Math.max(1, Number(sp.get("page_size") ?? "40") || 40));
		const offset = (page - 1) * pageSize;

		const rows = await db
			.select({
				id: couponRedemptions.id,
				profileId: couponRedemptions.profileId,
				subscriptionId: couponRedemptions.subscriptionId,
				redeemedAt: couponRedemptions.redeemedAt,
				fullName: profiles.fullName,
				email: authUsers.email,
			})
			.from(couponRedemptions)
			.innerJoin(profiles, eq(couponRedemptions.profileId, profiles.id))
			.leftJoin(authUsers, eq(authUsers.id, profiles.id))
			.where(eq(couponRedemptions.couponId, coupon.id))
			.orderBy(desc(couponRedemptions.redeemedAt))
			.limit(pageSize)
			.offset(offset);

		const [{ total }] = await db
			.select({ total: count() })
			.from(couponRedemptions)
			.where(eq(couponRedemptions.couponId, coupon.id));

		return NextResponse.json(
			{
				data: rows.map((r) => ({
					id: r.id,
					profile_id: r.profileId,
					subscription_id: r.subscriptionId,
					redeemed_at: r.redeemedAt.toISOString(),
					full_name: r.fullName,
					email: r.email,
				})),
				total: Number(total ?? 0),
				page,
				page_size: pageSize,
			},
			{ headers: adminHeaders() },
		);
	});
}
