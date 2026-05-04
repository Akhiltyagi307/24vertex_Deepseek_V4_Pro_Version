import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { refundPayment } from "@/lib/billing/razorpay";
import { db } from "@/db";
import { adminRefundIdempotency, payments } from "@/db/schema/billing";

export const runtime = "nodejs";

const bodySchema = z.object({
	amount_paise: z.number().int().positive().optional(),
});

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const idempotencyKey = request.headers.get("idempotency-key")?.trim();
		if (!idempotencyKey) {
			return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400, headers: adminHeaders() });
		}

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid payment id" }, { status: 400, headers: adminHeaders() });
		}

		let body: unknown = {};
		try {
			body = await request.json();
		} catch {
			body = {};
		}
		const parsed = bodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}

		const payRows = await db.select().from(payments).where(eq(payments.id, uuid.data)).limit(1);
		const pay = payRows[0];
		if (!pay) return NextResponse.json({ error: "Not found" }, { status: 404, headers: adminHeaders() });
		if (!pay.razorpayPaymentId) {
			return NextResponse.json({ error: "Payment has no Razorpay id" }, { status: 400, headers: adminHeaders() });
		}
		if (pay.refundedAt) {
			return NextResponse.json({ error: "Already refunded" }, { status: 409, headers: adminHeaders() });
		}

		const reserved = await db
			.insert(adminRefundIdempotency)
			.values({ idempotencyKey, paymentId: pay.id, razorpayRefundId: null })
			.onConflictDoNothing({ target: adminRefundIdempotency.idempotencyKey })
			.returning({ key: adminRefundIdempotency.idempotencyKey });
		if (!reserved[0]) {
			const prev = await db
				.select({ razorpayRefundId: adminRefundIdempotency.razorpayRefundId })
				.from(adminRefundIdempotency)
				.where(eq(adminRefundIdempotency.idempotencyKey, idempotencyKey))
				.limit(1);
			return NextResponse.json(
				{ ok: true, deduped: true, razorpay_refund_id: prev[0]?.razorpayRefundId ?? null },
				{ headers: adminHeaders() },
			);
		}

		let rzpRefundId: string;
		try {
			const r = await refundPayment(pay.razorpayPaymentId, {
				amountPaise: parsed.data.amount_paise,
				notes: { source: "admin_panel", payment_row: pay.id },
			});
			rzpRefundId = r.id;
		} catch (e) {
			await db.delete(adminRefundIdempotency).where(eq(adminRefundIdempotency.idempotencyKey, idempotencyKey));
			const msg = e instanceof Error ? e.message : String(e);
			return NextResponse.json({ error: msg }, { status: 502, headers: adminHeaders() });
		}

		const amountRefunded = parsed.data.amount_paise ?? pay.amountPaise;
		const now = new Date();
		await db
			.update(adminRefundIdempotency)
			.set({ razorpayRefundId: rzpRefundId })
			.where(eq(adminRefundIdempotency.idempotencyKey, idempotencyKey));
		await db
			.update(payments)
			.set({
				razorpayRefundId: rzpRefundId,
				refundAmountPaise: amountRefunded,
				refundedAt: now,
				status: "refunded",
			})
			.where(eq(payments.id, pay.id));

		await writeAdminAction({
			action: "payment_refund",
			targetType: "payment",
			targetId: pay.id,
			payload: { razorpay_payment_id: pay.razorpayPaymentId, razorpay_refund_id: rzpRefundId, amount_paise: amountRefunded },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true, razorpay_refund_id: rzpRefundId }, { headers: adminHeaders() });
	});
}
