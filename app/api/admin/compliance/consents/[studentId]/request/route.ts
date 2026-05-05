import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminActionStrict } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { sendParentalConsentRerequestEmail } from "@/lib/email/compliance-emails";
import { adminGetUserById } from "@/lib/admin/users-list";
import { db } from "@/db";
import { parentalConsents } from "@/db/schema/parental-consents";
import { parentStudentLinks } from "@/db/schema/profiles";

export const runtime = "nodejs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { studentId } = await ctx.params;
	const uuid = z.string().uuid().safeParse(studentId);
	if (!uuid.success) return adminErrorResponse("Invalid student id");

	const student = await adminGetUserById(uuid.data);
	if (!student || student.role !== "student") {
		return adminErrorResponse("Student not found", { status: 404 });
	}

	const [link] = await db
		.select({ parentId: parentStudentLinks.parentId })
		.from(parentStudentLinks)
		.where(eq(parentStudentLinks.studentId, uuid.data))
		.limit(1);

	let parentEmail: string | null = null;
	if (link?.parentId) {
		const parent = await adminGetUserById(link.parentId);
		parentEmail = parent?.email?.trim() ?? null;
	}
	if (!parentEmail) {
		const [consent] = await db
			.select()
			.from(parentalConsents)
			.where(eq(parentalConsents.studentId, uuid.data))
			.orderBy(desc(parentalConsents.grantedAt))
			.limit(1);
		parentEmail = consent?.parentEmail?.trim() ?? null;
	}
	if (!parentEmail) return adminErrorResponse("No parent email on file", { status: 409 });

	const { error } = await sendParentalConsentRerequestEmail({
		to: parentEmail,
		studentName: student.full_name ?? "Student",
		studentId: uuid.data,
	});
	if (error) return adminErrorResponse(error, { status: 500 });

	// Strict audit: dispatched mail through Resend asking a parent to renew
	// consent — both compliance and outbound-mail tracks must record it.
	await writeAdminActionStrict({
		action: ADMIN_ACTIONS.PARENTAL_CONSENT_RERREQUEST_SENT,
		targetType: "profile",
		targetId: uuid.data,
		payload: { parent_email: parentEmail },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminAckResponse();
}
