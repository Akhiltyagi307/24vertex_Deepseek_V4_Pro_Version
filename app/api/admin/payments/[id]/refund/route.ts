import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction, writeAdminActionStrict } from "@/lib/admin/audit";
import { consumeAdminActionRateLimit, adminActionScope } from "@/lib/admin/rate-limit-action";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { refundPayment } from "@/lib/billing/razorpay";
import { db } from "@/db";
import { adminRefundIdempotency, payments } from "@/db/schema/billing";

export const runtime = "nodejs";

const bodySchema = z.object({
	amount_paise: z.number().int().positive().optional(),
});

const REFUND_RATE_LIMIT_PER_MIN = 5;
const REFUND_RATE_WINDOW_SEC = 60;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const idempotencyKey = request.headers.get("idempotency-key")?.trim();
		if (!idempotencyKey) {
			return adminErrorResponse("Idempotency-Key header required");
		}

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid payment id");

		let body: unknown = {};
		try {
			body = await request.json();
		} catch {
			body = {};
		}
		const parsed = bodySchema.safeParse(body);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
		}

		// Per-admin rate limit. Sits BEFORE idempotency reservation: if we 429,
		// no idempotency row gets locked, so the client can retry with the same
		// key once the window resets. Bursts of legitimate refunds (e.g. a
		// support agent processing a queue) get 5 per minute, which is plenty
		// of headroom; runaway scripts get throttled. A 429 is itself audited
		// so abuse patterns surface in `admin_action_log`.
		const ip = clientIpFromRequest(request);
		const ua = userAgentFromRequest(request);
		const rl = await consumeAdminActionRateLimit({
			action: ADMIN_ACTIONS.PAYMENT_REFUND,
			scope: adminActionScope({ jti: gate.jti, ip }),
			limit: REFUND_RATE_LIMIT_PER_MIN,
			windowSec: REFUND_RATE_WINDOW_SEC,
		});
		if (!rl.allowed) {
			void writeAdminAction({
				action: ADMIN_ACTIONS.PAYMENT_REFUND,
				targetType: "payment",
				targetId: uuid.data,
				payload: { rate_limited: true, reset_at: rl.resetAt.toISOString() },
				ipAddress: ip,
				userAgent: ua,
			});
			const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
			return adminErrorResponse("Too many refund attempts. Slow down.", {
				status: 429,
				code: "rate_limited",
				headers: { "Retry-After": String(retryAfterSec) },
			});
		}

		const payRows = await db.select().from(payments).where(eq(payments.id, uuid.data)).limit(1);
		const pay = payRows[0];
		if (!pay) return adminErrorResponse("Not found", { status: 404 });
		if (!pay.razorpayPaymentId) {
			return adminErrorResponse("Payment has no Razorpay id");
		}
		if (pay.refundedAt) {
			return adminErrorResponse("Already refunded", { status: 409 });
		}

		// Server-side validation: refund amount must not exceed what was paid.
		// Razorpay also rejects, but a clear 400 here saves a network round-trip
		// and gives operators a less cryptic error.
		if (parsed.data.amount_paise !== undefined && parsed.data.amount_paise > pay.amountPaise) {
			return adminErrorResponse(
				`Refund amount ${parsed.data.amount_paise} exceeds paid amount ${pay.amountPaise}`,
			);
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
			return adminAckResponse({ deduped: true, razorpay_refund_id: prev[0]?.razorpayRefundId ?? null });
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
			return adminErrorResponse(msg, { status: 502 });
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

		// Strict variant: a refund WITHOUT an audit row is a compliance hole, so
		// we fail-closed on audit failure (the actual refund already executed at
		// Razorpay; the 5xx tells operators something is wrong with audit and
		// they should investigate before issuing more refunds).
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.PAYMENT_REFUND,
			targetType: "payment",
			targetId: pay.id,
			payload: { razorpay_payment_id: pay.razorpayPaymentId, razorpay_refund_id: rzpRefundId, amount_paise: amountRefunded },
			ipAddress: ip,
			userAgent: ua,
		});

		return adminAckResponse({ razorpay_refund_id: rzpRefundId });
	});
}
