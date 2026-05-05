import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminListResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { authUsers } from "@/db/schema/auth-users";
import { payments } from "@/db/schema/billing";
import { profiles } from "@/db/schema/profiles";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const sp = request.nextUrl.searchParams;
		const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
		const pageSize = Math.min(200, Math.max(1, Number(sp.get("page_size") ?? "40") || 40));
		const offset = (page - 1) * pageSize;
		const q = sp.get("q")?.trim();

		const conditions: SQL[] = [];
		if (q) {
			const pattern = `%${q.replace(/%/g, "\\%")}%`;
			conditions.push(
				or(
					ilike(payments.razorpayPaymentId, pattern),
					ilike(profiles.fullName, pattern),
					ilike(authUsers.email, pattern),
				)!,
			);
		}
		const whereSql = conditions.length ? and(...conditions) : undefined;

		const base = db
			.select({
				id: payments.id,
				razorpayPaymentId: payments.razorpayPaymentId,
				profileId: payments.profileId,
				amountPaise: payments.amountPaise,
				status: payments.status,
				capturedAt: payments.capturedAt,
				refundedAt: payments.refundedAt,
				razorpayRefundId: payments.razorpayRefundId,
				fullName: profiles.fullName,
				email: authUsers.email,
				createdAt: payments.createdAt,
			})
			.from(payments)
			.innerJoin(profiles, eq(payments.profileId, profiles.id))
			.leftJoin(authUsers, eq(authUsers.id, profiles.id))
			.$dynamic();

		const rows = await (whereSql ? base.where(whereSql) : base)
			.orderBy(desc(payments.createdAt))
			.limit(pageSize)
			.offset(offset);

		const cq = db.select({ total: count() }).from(payments).innerJoin(profiles, eq(payments.profileId, profiles.id)).leftJoin(authUsers, eq(authUsers.id, profiles.id));
		const [{ total }] = await (whereSql ? cq.where(whereSql) : cq);

		return adminListResponse({
			data: rows.map((r) => ({
				id: r.id,
				razorpay_payment_id: r.razorpayPaymentId,
				profile_id: r.profileId,
				amount_paise: r.amountPaise,
				status: r.status,
				captured_at: r.capturedAt?.toISOString() ?? null,
				refunded_at: r.refundedAt?.toISOString() ?? null,
				razorpay_refund_id: r.razorpayRefundId,
				full_name: r.fullName,
				email: r.email,
				created_at: r.createdAt.toISOString(),
			})),
			total: Number(total ?? 0),
			page,
			pageSize,
		});
	});
}
