import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction, writeAdminActionStrict } from "@/lib/admin/audit";
import { consumeAdminTotp, verifyAdminTotpIfConfigured } from "@/lib/admin/auth";
import { isAdminTotpRequired } from "@/lib/admin/feature-flags";
import { adminActionScope, consumeAdminActionRateLimit } from "@/lib/admin/rate-limit-action";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { adminGetUserById } from "@/lib/admin/users-list";
import { performComplianceErasure } from "@/lib/compliance/erasure";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
	confirm_email: z.string().min(3).max(320),
	totp: z.string().optional(),
}).strict();

// 3 hard-deletes per minute per admin. The blast radius of an accidental or
// adversarial loop here is enormous (irreversibly removes a user from auth);
// even a generous reading shouldn't allow more than a handful in a window.
const HARD_DELETE_LIMIT = 3;
const HARD_DELETE_WINDOW_SEC = 60;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid user id");

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return adminErrorResponse("Invalid JSON");
		}
		const parsed = bodySchema.safeParse(body);
		if (!parsed.success) {
			return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
		}

		const before = await adminGetUserById(uuid.data);
		if (!before?.email) {
			return adminErrorResponse("User not found", { status: 404 });
		}

		const emailNorm = before.email.trim().toLowerCase();
		if (parsed.data.confirm_email.trim().toLowerCase() !== emailNorm) {
			return adminErrorResponse("confirm_email must match user email");
		}

		const totpRequired = await isAdminTotpRequired();
		// Consume (single-use) only when TOTP is actually being enforced; when
		// it's optional we still verify for the `totpUsed` audit signal without
		// burning the code's time-step.
		const totpOk = totpRequired
			? await consumeAdminTotp(parsed.data.totp)
			: verifyAdminTotpIfConfigured(parsed.data.totp);
		if (totpRequired && !totpOk) {
			return adminErrorResponse("TOTP required", { status: 401 });
		}

		const ip = clientIpFromRequest(request);
		const ua = userAgentFromRequest(request);

		// Rate limit fires AFTER input validation so a bad UUID or wrong
		// confirm-email doesn't burn the admin's bucket. It fires BEFORE the
		// destructive erase+ban so a runaway loop can't punch through.
		const rl = await consumeAdminActionRateLimit({
			action: ADMIN_ACTIONS.USER_HARD_DELETE_REQUEST,
			scope: adminActionScope({ jti: gate.jti, ip }),
			limit: HARD_DELETE_LIMIT,
			windowSec: HARD_DELETE_WINDOW_SEC,
		});
		if (!rl.allowed) {
			void writeAdminAction({
				action: ADMIN_ACTIONS.USER_HARD_DELETE_REQUEST,
				targetType: "profile",
				targetId: uuid.data,
				payload: { rate_limited: true, reset_at: rl.resetAt.toISOString() },
				ipAddress: ip,
				userAgent: ua,
			});
			const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
			return adminErrorResponse("Too many delete attempts. Slow down.", {
				status: 429,
				code: "rate_limited",
				headers: { "Retry-After": String(retryAfterSec) },
			});
		}

		// Strict pre-action audit: an admin attempt that proceeds without an
		// audit row is unacceptable for an irreversible operation. If the audit
		// DB is down, refuse the delete.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.USER_HARD_DELETE_REQUEST,
			targetType: "profile",
			targetId: uuid.data,
			payload: { email_snapshot: before.email, full_name_snapshot: before.full_name },
			ipAddress: ip,
			userAgent: ua,
			totpUsed: totpRequired && totpOk,
		});

		const supabase = createServiceRoleClient();
		// The auth row cannot be physically deleted: audit_logs, payments, and the
		// FERPA-retained tests all reference auth.users with ON DELETE NO ACTION, so
		// auth.admin.deleteUser() would raise a foreign-key violation. Instead
		// "erase + disable": run the compliance erasure (deletes non-retained child
		// data, anonymizes the profile, pseudonymizes the auth email) and then
		// permanently ban the account so it can never authenticate again.
		try {
			await performComplianceErasure(uuid.data, { dryRun: false });
		} catch (e) {
			Sentry.captureException(e, { tags: { feature: "admin" } });
			return adminErrorResponse(e instanceof Error ? e.message : "Erasure failed.", { status: 500 });
		}
		const { error } = await supabase.auth.admin.updateUserById(uuid.data, { ban_duration: "876600h" });
		if (error) {
			Sentry.captureException(error, { tags: { feature: "admin" } });
			return adminErrorResponse(error.message, { status: 500 });
		}

		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.USER_HARD_DELETE_DONE,
			targetType: "profile",
			targetId: uuid.data,
			payload: { email_snapshot: before.email, method: "erase_and_ban" },
			ipAddress: ip,
			userAgent: ua,
			totpUsed: totpRequired && totpOk,
		});

		return adminAckResponse();
	});
}
