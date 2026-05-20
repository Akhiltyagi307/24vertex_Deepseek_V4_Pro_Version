import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { setTeacherVerified } from "@/lib/admin/teacher-approval";
import { adminGetUserById } from "@/lib/admin/users-list";

export const runtime = "nodejs";

const bodySchema = z.object({
	reason: z.string().min(1).max(2000),
}).strict();

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const { id } = await ctx.params;
		const uuid = z.string().uuid().safeParse(id);
		if (!uuid.success) return adminErrorResponse("Invalid id");

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
		if (!profile || profile.role !== "teacher") {
			return adminErrorResponse("Teacher not found", { status: 404 });
		}

		await setTeacherVerified(uuid.data, false);

		await writeAdminAction({
			action: ADMIN_ACTIONS.TEACHER_REJECT,
			targetType: "profile",
			targetId: uuid.data,
			payload: { reason: parsed.data.reason },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return adminAckResponse();
	});
}
