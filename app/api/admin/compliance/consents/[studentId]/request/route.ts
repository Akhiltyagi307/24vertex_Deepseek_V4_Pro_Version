import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { sendParentalConsentRerequestEmail } from "@/lib/email/compliance-emails";
import { adminGetUserById } from "@/lib/admin/users-list";
import { db } from "@/db";
import { parentalConsents } from "@/db/schema/parental-consents";
import { parentStudentLinks } from "@/db/schema/profiles";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { studentId } = await ctx.params;
	const uuid = z.string().uuid().safeParse(studentId);
	if (!uuid.success) {
		return NextResponse.json({ error: "Invalid student id" }, { status: 400, headers: adminHeaders() });
	}

	const student = await adminGetUserById(uuid.data);
	if (!student || student.role !== "student") {
		return NextResponse.json({ error: "Student not found" }, { status: 404, headers: adminHeaders() });
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
	if (!parentEmail) {
		return NextResponse.json({ error: "No parent email on file" }, { status: 409, headers: adminHeaders() });
	}

	const { error } = await sendParentalConsentRerequestEmail({
		to: parentEmail,
		studentName: student.full_name ?? "Student",
		studentId: uuid.data,
	});
	if (error) {
		return NextResponse.json({ error }, { status: 500, headers: adminHeaders() });
	}

	await writeAdminAction({
		action: "parental_consent_rerequest_sent",
		targetType: "profile",
		targetId: uuid.data,
		payload: { parent_email: parentEmail },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true }, { headers: adminHeaders() });
}
