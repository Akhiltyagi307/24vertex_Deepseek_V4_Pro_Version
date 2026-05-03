import { NextResponse } from "next/server";

import { listPracticeAnalyticsEventsOrdered } from "@/lib/admin/analytics/export-preview-rows";
import { requireAdminApi } from "@/lib/admin/api-auth";

export const runtime = "nodejs";

const CSV_EXPORT_LIMIT = 50_000;

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET() {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const rows = await listPracticeAnalyticsEventsOrdered(CSV_EXPORT_LIMIT);

	const header = ["id", "student_id", "event_name", "occurred_at", "props_json"];
	const lines = [
		header.join(","),
		...rows.map((r) =>
			[
				r.id,
				r.studentId ?? "",
				JSON.stringify(r.eventName),
				r.occurredAt?.toISOString() ?? "",
				JSON.stringify(r.props ?? {}),
			].join(","),
		),
	];

	return new NextResponse(lines.join("\n"), {
		status: 200,
		headers: {
			...adminHeaders(),
			"content-type": "text/csv; charset=utf-8",
			"content-disposition": 'attachment; filename="practice_analytics_events.csv"',
		},
	});
}
