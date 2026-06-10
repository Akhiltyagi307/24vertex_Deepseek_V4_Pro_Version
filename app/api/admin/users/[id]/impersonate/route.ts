import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction, writeAdminActionStrict } from "@/lib/admin/audit";
import { consumeAdminTotp } from "@/lib/admin/auth";
import { ADMIN_IMPERSONATION_COOKIE } from "@/lib/admin/constants";
import { adminActionScope, consumeAdminActionRateLimit } from "@/lib/admin/rate-limit-action";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { adminGetUserById } from "@/lib/admin/users-list";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Impersonation magic-links shouldn't be minted in bulk — each one represents
// a possible takeover of a user account. 5/min covers a support agent walking
// through a queue; anything more is suspicious.
const IMPERSONATE_LIMIT = 5;
const IMPERSONATE_WINDOW_SEC = 60;

const bodySchema = z.object({ totp: z.string().optional() }).strict();

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

		const profile = await adminGetUserById(uuid.data);
		if (!profile?.email) {
			return adminErrorResponse("User not found or missing auth email", { status: 404 });
		}

		const ip = clientIpFromRequest(request);
		const ua = userAgentFromRequest(request);
		const rl = await consumeAdminActionRateLimit({
			action: ADMIN_ACTIONS.IMPERSONATE,
			scope: adminActionScope({ jti: gate.jti, ip }),
			limit: IMPERSONATE_LIMIT,
			windowSec: IMPERSONATE_WINDOW_SEC,
		});
		if (!rl.allowed) {
			void writeAdminAction({
				action: ADMIN_ACTIONS.IMPERSONATE,
				targetType: "profile",
				targetId: uuid.data,
				payload: { rate_limited: true, reset_at: rl.resetAt.toISOString() },
				ipAddress: ip,
				userAgent: ua,
			});
			const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000));
			return adminErrorResponse("Too many impersonation attempts. Slow down.", {
				status: 429,
				code: "rate_limited",
				headers: { "Retry-After": String(retryAfterSec) },
			});
		}

		// L3: impersonation mints a full account-takeover magic-link, so require a
		// fresh TOTP step-up (single-use, fail-closed) — same posture as compliance
		// erasure and writable SQL. Checked after the rate limit so a throttled
		// request doesn't burn the operator's code.
		if (!process.env.ADMIN_TOTP_SECRET?.trim()) {
			return adminErrorResponse("ADMIN_TOTP_SECRET must be configured before impersonation", {
				status: 403,
			});
		}
		if (!parsed.data.totp?.trim() || !(await consumeAdminTotp(parsed.data.totp))) {
			return adminErrorResponse("Valid TOTP required", { status: 401 });
		}

		const supabase = createServiceRoleClient();
		const { data, error } = await supabase.auth.admin.generateLink({
			type: "magiclink",
			email: profile.email,
		});

		if (error || !data?.properties?.action_link) {
			Sentry.captureException(error ?? new Error("no action_link"), { tags: { feature: "admin" } });
			return adminErrorResponse(error?.message ?? "Failed to generate link", { status: 500 });
		}

		// Strict: minting a magic-link without an audit trail is a takeover
		// vector. If the audit insert fails, surface a 5xx — operators must see
		// why before more links are minted.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.IMPERSONATE,
			targetType: "profile",
			targetId: uuid.data,
			payload: { email_snapshot: profile.email },
			ipAddress: ip,
			userAgent: ua,
		});

		const res = adminAckResponse({ magic_link: data.properties.action_link });
		res.cookies.set(ADMIN_IMPERSONATION_COOKIE, "1", {
			httpOnly: false,
			sameSite: "lax",
			path: "/",
			maxAge: 15 * 60,
			secure: process.env.NODE_ENV === "production",
		});
		return res;
	});
}
