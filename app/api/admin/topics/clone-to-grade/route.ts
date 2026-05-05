import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { cloneTopicsToGrade } from "@/lib/admin/topics/clone-to-grade";
import { revalidateCurriculumTopicCaches } from "@/lib/cache/curriculum-topic-counts";

export const runtime = "nodejs";

const bodySchema = z.object({
	source_topic_ids: z.array(z.string().uuid()).min(1),
	target_grade: z.number().int().min(1).max(12),
});

export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

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

		try {
			const count = await cloneTopicsToGrade(parsed.data.source_topic_ids, parsed.data.target_grade);
			await writeAdminAction({
				action: ADMIN_ACTIONS.TOPIC_CLONE_TO_GRADE,
				targetType: "topics",
				payload: { count, target_grade: parsed.data.target_grade },
				ipAddress: clientIpFromRequest(request),
				userAgent: userAgentFromRequest(request),
			});
			revalidateCurriculumTopicCaches();
			return adminAckResponse({ inserted: count });
		} catch (e) {
			const msg = e instanceof Error ? e.message : "clone failed";
			return adminErrorResponse(msg);
		}
	});
}
