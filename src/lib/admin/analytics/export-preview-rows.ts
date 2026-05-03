import "server-only";

import { desc } from "drizzle-orm";

import { db } from "@/db";
import { practiceAnalyticsEvents } from "@/db/schema/practice-tables";

/** Full rows for CSV download or UI preview (call with different limits). */
export async function listPracticeAnalyticsEventsOrdered(limit: number) {
	return db
		.select()
		.from(practiceAnalyticsEvents)
		.orderBy(desc(practiceAnalyticsEvents.occurredAt))
		.limit(limit);
}

export function practiceAnalyticsRowsToExportRecords(
	rows: Awaited<ReturnType<typeof listPracticeAnalyticsEventsOrdered>>,
): Record<string, unknown>[] {
	return rows.map((r) => ({
		id: r.id,
		student_id: r.studentId ?? "",
		event_name: r.eventName,
		occurred_at: r.occurredAt?.toISOString() ?? "",
		props_json: JSON.stringify(r.props ?? {}),
	}));
}
