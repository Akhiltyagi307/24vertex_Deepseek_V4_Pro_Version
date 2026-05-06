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
import { BILLING_ACTION_FAILURE_KINDS } from "@/lib/billing/action-failures";
import { db } from "@/db";
import { billingActionFailures } from "@/db/schema/billing";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const RATE_LIMIT_PER_MIN = 20;
const RATE_WINDOW_SEC = 60;

const idSchema = z.string().uuid();

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const parsedId = idSchema.safeParse(id);
		if (!parsedId.success) return adminErrorResponse("Invalid id");

		const ip = clientIpFromRequest(request);
		const ua = userAgentFromRequest(request);

		const rl = await consumeAdminActionRateLimit({
			action: ADMIN_ACTIONS.BILLING_ACTION_FAILURE_RETRY,
			scope: adminActionScope({ jti: gate.jti, ip }),
			limit: RATE_LIMIT_PER_MIN,
			windowSec: RATE_WINDOW_SEC,
		});
		if (!rl.allowed) {
			void writeAdminAction({
				action: ADMIN_ACTIONS.BILLING_ACTION_FAILURE_RETRY,
				targetType: "billing_action_failure",
				targetId: parsedId.data,
				payload: { rate_limited: true },
				ipAddress: ip,
				userAgent: ua,
			});
			const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
			return adminErrorResponse("Too many retry attempts.", {
				status: 429,
				code: "rate_limited",
				headers: { "Retry-After": String(retryAfterSec) },
			});
		}

		const rows = await db
			.select()
			.from(billingActionFailures)
			.where(eq(billingActionFailures.id, parsedId.data))
			.limit(1);
		const failure = rows[0];
		if (!failure) return adminErrorResponse("Not found", { status: 404 });
		if (failure.resolvedAt) {
			return adminErrorResponse("Already resolved", { status: 409 });
		}

		// Per-kind retry. Kept inline (not switch-table) so each branch reads
		// linearly — easy to add a new kind without touching plumbing.
		const admin = createServiceRoleClient();
		let retryError: string | null = null;
		let retrySucceeded = false;

		if (failure.kind === BILLING_ACTION_FAILURE_KINDS.COUPON_REDEMPTION) {
			const couponId = failure.couponId;
			const profileId = failure.profileId;
			const subscriptionId = failure.subscriptionId;
			if (!couponId || !profileId || !subscriptionId) {
				retryError = "Failure row missing required references (coupon_id/profile_id/subscription_id).";
			} else {
				const { data, error } = await admin.rpc("billing_apply_checkout_coupon_redemption_atomic", {
					p_coupon_id: couponId,
					p_profile_id: profileId,
					p_our_subscription_id: subscriptionId,
				});
				if (error) {
					retryError = `coupon_redemption_atomic: ${error.message}`;
				} else {
					const row = (Array.isArray(data) ? data[0] : data) as { ok?: boolean; applied?: boolean } | undefined;
					retrySucceeded = Boolean(row?.ok);
					// `applied=false` means the redemption already existed (idempotent
					// dedup). That's a successful retry — the original failure is no
					// longer real.
				}
			}
		} else {
			retryError = `Retry handler not implemented for kind: ${failure.kind}`;
		}

		const now = new Date();
		await db
			.update(billingActionFailures)
			.set({
				retryCount: failure.retryCount + 1,
				lastRetryAt: now,
				...(retrySucceeded
					? { resolvedAt: now, resolvedByJti: gate.jti, resolutionNote: "auto-resolved on successful retry" }
					: { errorMessage: retryError ?? failure.errorMessage }),
			})
			.where(eq(billingActionFailures.id, failure.id));

		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.BILLING_ACTION_FAILURE_RETRY,
			targetType: "billing_action_failure",
			targetId: failure.id,
			payload: {
				kind: failure.kind,
				succeeded: retrySucceeded,
				error: retryError,
				retry_count: failure.retryCount + 1,
			},
			ipAddress: ip,
			userAgent: ua,
		});

		if (retrySucceeded) {
			return adminAckResponse({ resolved: true });
		}
		return adminErrorResponse(retryError ?? "Retry failed", { status: 502 });
	});
}
