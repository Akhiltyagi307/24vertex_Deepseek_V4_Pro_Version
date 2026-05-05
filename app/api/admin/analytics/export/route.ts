import { NextRequest, NextResponse } from "next/server";

import { listPracticeAnalyticsEventsOrdered } from "@/lib/admin/analytics/export-preview-rows";
import { requireAdminApi } from "@/lib/admin/api-auth";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { ADMIN_RESPONSE_HEADERS } from "@/lib/admin/response";

export const runtime = "nodejs";

const CSV_EXPORT_LIMIT = 50_000;

export async function GET(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const rows = await listPracticeAnalyticsEventsOrdered(CSV_EXPORT_LIMIT);

	// Bulk PII export — every download must leave an audit trail. Logged
	// before the response is sent so a failed download still records intent.
	await writeAdminAction({
		action: ADMIN_ACTIONS.ANALYTICS_EXPORT,
		targetType: "practice_analytics_events",
		payload: {
			format: "csv",
			row_count: rows.length,
			limit: CSV_EXPORT_LIMIT,
		},
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

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
			...ADMIN_RESPONSE_HEADERS,
			"content-type": "text/csv; charset=utf-8",
			"content-disposition": 'attachment; filename="practice_analytics_events.csv"',
		},
	});
}
