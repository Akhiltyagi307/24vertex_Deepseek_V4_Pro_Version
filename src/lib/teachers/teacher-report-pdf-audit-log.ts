import "server-only";

export type TeacherReportPdfOutcome =
	| "invalid_test_id"
	| "unauthorized"
	| "forbidden_not_teacher"
	| "forbidden_not_owner"
	| "not_found_test"
	| "rate_limited"
	| "rate_limit_service_unavailable";

/**
 * Single-line JSON for log drains (e.g. Vercel/Datadog). Alert on spikes of
 * HTTP 403/404 responses from the teacher report PDF route.
 */
export function logTeacherReportPdfOutcome(args: {
	outcome: TeacherReportPdfOutcome;
	status: number;
	userId?: string | null;
	testId?: string;
}): void {
	const payload = {
		ctx: "teacher_report_pdf",
		ts: new Date().toISOString(),
		outcome: args.outcome,
		status: args.status,
		userId: args.userId ?? undefined,
		testId: args.testId ?? undefined,
	};
	console.warn(JSON.stringify(payload));
}
