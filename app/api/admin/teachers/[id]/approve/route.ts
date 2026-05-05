import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { sendTeacherApprovedEmail } from "@/lib/email/teacher-approved-email";
import { insertTeacherWelcomeNotification, setTeacherVerified } from "@/lib/admin/teacher-approval";
import { adminGetUserById } from "@/lib/admin/users-list";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid id");

		const profile = await adminGetUserById(uuid.data);
		if (!profile || profile.role !== "teacher") {
			return adminErrorResponse("Teacher not found", { status: 404 });
		}

		const ok = await setTeacherVerified(uuid.data, true);
		if (!ok) return adminErrorResponse("Update failed", { status: 500 });

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

		// Strict audit: approval flips a profile flag, dispatches an email
		// through Resend, and inserts a notification — three side effects we
		// must be able to attribute.
		await writeAdminActionStrict({
			action: ADMIN_ACTIONS.TEACHER_APPROVE,
			targetType: "profile",
			targetId: uuid.data,
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
