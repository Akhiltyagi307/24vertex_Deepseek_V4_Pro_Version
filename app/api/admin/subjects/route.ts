import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { writeAdminAction } from "@/lib/admin/audit";
import { adminSubjectCreateSchema } from "@/lib/admin/schemas/subject";
import { revalidateCurriculumTopicCaches } from "@/lib/cache/curriculum-topic-counts";
import { db } from "@/db";
import { subjects } from "@/db/schema/academic";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const rows = await db
			.select()
			.from(subjects)
			.orderBy(asc(subjects.grade), asc(subjects.sortOrder), asc(subjects.name));

		return NextResponse.json({ data: rows }, { headers: adminHeaders() });
	});
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
		const parsed = adminSubjectCreateSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: adminHeaders() });
		}
		const b = parsed.data;
		const inserted = await db
			.insert(subjects)
			.values({
				name: b.name,
				grade: b.grade,
				subjectGroup: b.subject_group ?? null,
				stream: b.stream ?? null,
				isElective: b.is_elective ?? false,
				sortOrder: b.sort_order ?? 0,
			})
			.returning({ id: subjects.id });

		const id = inserted[0]?.id;
		if (id) {
			await writeAdminAction({
				action: "subject_create",
				targetType: "subject",
				targetId: id,
				payload: { name: b.name, grade: b.grade },
				ipAddress: clientIpFromRequest(request),
				userAgent: userAgentFromRequest(request),
			});
		}

		revalidateCurriculumTopicCaches();
		return NextResponse.json({ ok: true, id }, { status: 201, headers: adminHeaders() });
	});
}
