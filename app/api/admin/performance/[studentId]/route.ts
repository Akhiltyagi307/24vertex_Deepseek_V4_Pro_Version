import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { db } from "@/db";
import { subjects, topics } from "@/db/schema/academic";
import { performanceTracker } from "@/db/schema/assessment";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(_request: Request, ctx: { params: Promise<{ studentId: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { studentId } = await ctx.params;

	const rows = await db
		.select({
			id: performanceTracker.id,
			topicId: performanceTracker.topicId,
			subjectId: performanceTracker.subjectId,
			status: performanceTracker.status,
			averageScore: performanceTracker.averageScore,
			testsTaken: performanceTracker.testsTaken,
			trend: performanceTracker.trend,
			topicName: topics.topicName,
			subjectName: subjects.name,
		})
		.from(performanceTracker)
		.innerJoin(topics, eq(performanceTracker.topicId, topics.id))
		.innerJoin(subjects, eq(performanceTracker.subjectId, subjects.id))
		.where(eq(performanceTracker.studentId, studentId));

	return NextResponse.json({ data: rows }, { headers: adminHeaders() });
}
