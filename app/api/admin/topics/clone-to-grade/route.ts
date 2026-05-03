import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { cloneTopicsToGrade } from "@/lib/admin/topics/clone-to-grade";

export const runtime = "nodejs";

const bodySchema = z.object({
	source_topic_ids: z.array(z.string().uuid()).min(1),
	target_grade: z.number().int().min(1).max(12),
});

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function POST(request: NextRequest) {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

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

		try {
			const count = await cloneTopicsToGrade(parsed.data.source_topic_ids, parsed.data.target_grade);
			await writeAdminAction({
				action: "topic_clone_to_grade",
				targetType: "topics",
				payload: { count, target_grade: parsed.data.target_grade },
				ipAddress: clientIpFromRequest(request),
				userAgent: userAgentFromRequest(request),
			});
			return NextResponse.json({ ok: true, inserted: count }, { headers: adminHeaders() });
		} catch (e) {
			const msg = e instanceof Error ? e.message : "clone failed";
			return NextResponse.json({ error: msg }, { status: 400, headers: adminHeaders() });
		}
	});
}
