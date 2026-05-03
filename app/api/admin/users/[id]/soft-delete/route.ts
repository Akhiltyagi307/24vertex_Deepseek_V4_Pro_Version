import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { anonymizeProfile } from "@/lib/admin/anonymize";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminGetUserById } from "@/lib/admin/users-list";

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

		const before = await adminGetUserById(uuid.data);
		if (!before) {
			return NextResponse.json({ error: "User not found" }, { status: 404, headers: adminHeaders() });
		}

		await anonymizeProfile(uuid.data);

		await writeAdminAction({
			action: "user_soft_delete",
			targetType: "profile",
			targetId: uuid.data,
			payload: { email_snapshot: before.email, full_name_snapshot: before.full_name },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
