"use client";

import dynamic from "next/dynamic";

import type { StudentDashboardAnalyticsPayload } from "@/lib/student/dashboard-analytics";

function StudentDashboardAnalyticsSkeleton() {
	return (
		<div
			className="min-h-[280px] w-full animate-pulse rounded-xl border border-border/60 bg-muted/30"
			aria-hidden
		/>
	);
}

const StudentDashboardAnalyticsImpl = dynamic(
	() =>
		import("./student-dashboard-analytics-impl").then((m) => ({
			default: m.StudentDashboardAnalytics,
		})),
	{ ssr: false, loading: () => <StudentDashboardAnalyticsSkeleton /> },
);

export function StudentDashboardAnalytics({
	payload,
}: {
	payload: StudentDashboardAnalyticsPayload;
}) {
	return <StudentDashboardAnalyticsImpl payload={payload} />;
}
