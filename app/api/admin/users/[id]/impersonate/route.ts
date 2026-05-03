import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { ADMIN_IMPERSONATION_COOKIE } from "@/lib/admin/constants";
import { adminGetUserById } from "@/lib/admin/users-list";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

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

		const profile = await adminGetUserById(uuid.data);
		if (!profile?.email) {
			return NextResponse.json({ error: "User not found or missing auth email" }, { status: 404, headers: adminHeaders() });
		}

		const supabase = createServiceRoleClient();
		const { data, error } = await supabase.auth.admin.generateLink({
			type: "magiclink",
			email: profile.email,
		});

		if (error || !data?.properties?.action_link) {
			Sentry.captureException(error ?? new Error("no action_link"), { tags: { feature: "admin" } });
			return NextResponse.json({ error: error?.message ?? "Failed to generate link" }, { status: 500, headers: adminHeaders() });
		}

		await writeAdminAction({
			action: "impersonate",
			targetType: "profile",
			targetId: uuid.data,
			payload: { email_snapshot: profile.email },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		const res = NextResponse.json(
			{ ok: true, magic_link: data.properties.action_link },
			{ headers: adminHeaders() },
		);
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
