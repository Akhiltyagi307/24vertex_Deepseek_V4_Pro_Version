import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { db } from "@/db";
import { subjects } from "@/db/schema/academic";

export const runtime = "nodejs";

const bodySchema = z.object({
	ids: z.array(z.string().uuid()).min(1),
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

		const ids = parsed.data.ids;
		const rows = await db.select({ id: subjects.id, grade: subjects.grade }).from(subjects).where(inArray(subjects.id, ids));
		if (rows.length !== ids.length) {
			return NextResponse.json({ error: "Unknown subject id" }, { status: 400, headers: adminHeaders() });
		}
		const grades = new Set(rows.map((r) => r.grade));
		if (grades.size !== 1) {
			return NextResponse.json({ error: "All ids must be the same grade" }, { status: 400, headers: adminHeaders() });
		}

		await db.transaction(async (tx) => {
			for (let i = 0; i < ids.length; i += 1) {
				await tx
					.update(subjects)
					.set({ sortOrder: i, updatedAt: new Date() })
					.where(eq(subjects.id, ids[i]!));
			}
		});

		await writeAdminAction({
			action: "subject_reorder",
			targetType: "subjects",
			payload: { ids },
			ipAddress: clientIpFromRequest(request),
			userAgent: userAgentFromRequest(request),
		});

		return NextResponse.json({ ok: true }, { headers: adminHeaders() });
	});
}
