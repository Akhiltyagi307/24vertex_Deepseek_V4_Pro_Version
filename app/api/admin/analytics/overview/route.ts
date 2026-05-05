import { and, count, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_RESPONSE_HEADERS, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { practiceAnalyticsEvents } from "@/db/schema/practice-tables";
import { profiles } from "@/db/schema/profiles";

export const runtime = "nodejs";

export async function GET() {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const since30 = new Date();
	since30.setDate(since30.getDate() - 30);

	try {
		const [students] = await db
			.select({ c: count() })
			.from(profiles)
			.where(and(eq(profiles.role, "student"), isNull(profiles.deletedAt)));

		const [activeStudents] = await db
			.select({ c: sql<number>`count(distinct ${practiceAnalyticsEvents.studentId})::int` })
			.from(practiceAnalyticsEvents)
			.where(and(gte(practiceAnalyticsEvents.occurredAt, since30), isNotNull(practiceAnalyticsEvents.studentId)));

		const funnel = await db
			.select({
				eventName: practiceAnalyticsEvents.eventName,
				n: count(),
			})
			.from(practiceAnalyticsEvents)
			.where(gte(practiceAnalyticsEvents.occurredAt, since30))
			.groupBy(practiceAnalyticsEvents.eventName)
			.orderBy(desc(count()));

		return NextResponse.json(
			{
				total_students: Number(students?.c ?? 0),
				active_students_analytics_30d: Number(activeStudents?.c ?? 0),
				events_30d: funnel,
			},
			{ headers: { ...ADMIN_RESPONSE_HEADERS } },
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Internal error";
		return adminErrorResponse(msg, { status: 500 });
	}
}
