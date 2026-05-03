import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { sendTeacherApprovedEmail } from "@/lib/email/teacher-approved-email";
import { insertTeacherWelcomeNotification, setTeacherVerified } from "@/lib/admin/teacher-approval";
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
			return NextResponse.json({ error: "Invalid id" }, { status: 400, headers: adminHeaders() });
		}

		const profile = await adminGetUserById(uuid.data);
		if (!profile || profile.role !== "teacher") {
			return NextResponse.json({ error: "Teacher not found" }, { status: 404, headers: adminHeaders() });
		}

		const ok = await setTeacherVerified(uuid.data, true);
		if (!ok) {
			return NextResponse.json({ error: "Update failed" }, { status: 500, headers: adminHeaders() });
		}

		if (profile.email) {
			const sent = await sendTeacherApprovedEmail(profile.email, profile.full_name);
			if (!sent.ok) {
				Sentry.captureMessage("teacher_approve_email_failed", { level: "warning", extra: { error: sent.error } });
			}
		}

		await insertTeacherWelcomeNotification(
			uuid.data,
			"Teacher account approved",
			"Your teacher account has been approved. You can sign in from the teacher portal.",
		);

		await writeAdminAction({
			action: "teacher_approve",
			targetType: "profile",
			targetId: uuid.data,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
