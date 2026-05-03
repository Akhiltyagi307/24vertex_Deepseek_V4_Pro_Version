import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { verifyAdminTotpIfConfigured } from "@/lib/admin/auth";
import { isAdminTotpRequired } from "@/lib/admin/feature-flags";
import { adminGetUserById } from "@/lib/admin/users-list";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
	confirm_email: z.string().min(3).max(320),
	totp: z.string().optional(),
});

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) {
			return NextResponse.json({ error: "Invalid user id" }, { status: 400, headers: adminHeaders() });
		}

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
		}
		const parsed = bodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}

		const before = await adminGetUserById(uuid.data);
		if (!before?.email) {
			return NextResponse.json({ error: "User not found" }, { status: 404, headers: adminHeaders() });
		}

		const emailNorm = before.email.trim().toLowerCase();
		if (parsed.data.confirm_email.trim().toLowerCase() !== emailNorm) {
			return NextResponse.json({ error: "confirm_email must match user email" }, { status: 400, headers: adminHeaders() });
		}

		const totpRequired = await isAdminTotpRequired();
		const totpOk = verifyAdminTotpIfConfigured(parsed.data.totp);
		if (totpRequired && !totpOk) {
			return NextResponse.json({ error: "TOTP required" }, { status: 401, headers: adminHeaders() });
		}

		await writeAdminAction({
			action: "user_hard_delete_request",
			targetType: "profile",
			targetId: uuid.data,
			payload: { email_snapshot: before.email, full_name_snapshot: before.full_name },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
			totpUsed: totpRequired && totpOk,
		});

		const supabase = createServiceRoleClient();
		const { error } = await supabase.auth.admin.deleteUser(uuid.data);
		if (error) {
			Sentry.captureException(error, { tags: { feature: "admin" } });
			return NextResponse.json({ error: error.message }, { status: 500, headers: adminHeaders() });
		}

		await writeAdminAction({
			action: "user_hard_delete_done",
			targetType: "profile",
			targetId: uuid.data,
			payload: { email_snapshot: before.email },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
			totpUsed: totpRequired && totpOk,
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
