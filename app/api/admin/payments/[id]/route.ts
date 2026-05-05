import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { authUsers } from "@/db/schema/auth-users";
import { payments } from "@/db/schema/billing";
import { profiles } from "@/db/schema/profiles";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return adminErrorResponse("Invalid payment id");
		}

		const rows = await db
			.select({
				p: payments,
				fullName: profiles.fullName,
				email: authUsers.email,
			})
			.from(payments)
			.innerJoin(profiles, eq(payments.profileId, profiles.id))
			.leftJoin(authUsers, eq(authUsers.id, profiles.id))
			.where(eq(payments.id, uuid.data))
			.limit(1);

		const row = rows[0];
		if (!row) return adminErrorResponse("Not found", { status: 404 });
		const p = row.p;

		return adminDetailResponse({
			id: p.id,
			subscription_id: p.subscriptionId,
			profile_id: p.profileId,
			razorpay_payment_id: p.razorpayPaymentId,
			razorpay_invoice_id: p.razorpayInvoiceId,
			razorpay_order_id: p.razorpayOrderId,
			amount_paise: p.amountPaise,
			currency: p.currency,
			status: p.status,
			method: p.method,
			invoice_short_url: p.invoiceShortUrl,
			captured_at: p.capturedAt?.toISOString() ?? null,
			metadata: p.metadata,
			created_at: p.createdAt.toISOString(),
			razorpay_refund_id: p.razorpayRefundId,
			refund_amount_paise: p.refundAmountPaise,
			refunded_at: p.refundedAt?.toISOString() ?? null,
			full_name: row.fullName,
			email: row.email,
		});
	});
}
