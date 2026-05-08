import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { isMaintenanceModeEnabled } from "./feature-flags";

export type MaintenanceReadinessSignal = {
	id: string;
	label: string;
	count: number;
	severity: "ok" | "warn" | "block";
	hint: string;
	href: string;
};

export type MaintenanceReadiness = {
	envFlag: boolean;
	dbFlag: boolean;
	maintenanceActive: boolean;
	signals: MaintenanceReadinessSignal[];
	checkedAt: string;
};

async function singleCount(query: ReturnType<typeof sql>): Promise<number> {
	const res = await db.execute(query);
	const row = res[0] as { n: number | string } | undefined;
	return Number(row?.n ?? 0);
}

async function countActiveAdminSessions(): Promise<number> {
	return singleCount(sql`
		SELECT COUNT(*)::int AS n
		FROM admin_sessions
		WHERE revoked_at IS NULL
			AND last_seen_at >= now() - interval '30 minutes'
	`);
}

async function countLiveInProgressTests(): Promise<number> {
	return singleCount(sql`
		SELECT COUNT(*)::int AS n
		FROM tests
		WHERE status = 'in_progress'
			AND updated_at >= now() - interval '5 minutes'
	`);
}

async function countPendingOperatorJobs(): Promise<number> {
	return singleCount(sql`
		SELECT COUNT(*)::int AS n
		FROM jobs
		WHERE finished_at IS NULL
	`);
}

async function countUnprocessedBillingWebhooks(): Promise<number> {
	return singleCount(sql`
		SELECT COUNT(*)::int AS n
		FROM billing_events
		WHERE processed_at IS NULL AND resolved_at IS NULL
	`);
}

async function countOverdueComplianceRequests(): Promise<number> {
	return singleCount(sql`
		SELECT COUNT(*)::int AS n
		FROM compliance_requests
		WHERE status = 'open' AND due_at IS NOT NULL AND due_at < now()
	`);
}

async function countRecentFailedHealthPings(): Promise<number> {
	return singleCount(sql`
		SELECT COUNT(*)::int AS n
		FROM service_health_pings
		WHERE status = 'failed' AND checked_at >= now() - interval '1 hour'
	`);
}

function severity(count: number, warn: number, block: number): "ok" | "warn" | "block" {
	if (count >= block) return "block";
	if (count >= warn) return "warn";
	return "ok";
}

export async function getMaintenanceReadiness(): Promise<MaintenanceReadiness> {
	const envFlag = process.env.MAINTENANCE_MODE === "true";
	const [
		dbFlag,
		activeAdminSessions,
		liveInProgressTests,
		pendingOperatorJobs,
		unprocessedBillingWebhooks,
		overdueComplianceRequests,
		recentFailedHealthPings,
	] = await Promise.all([
		isMaintenanceModeEnabled(),
		countActiveAdminSessions(),
		countLiveInProgressTests(),
		countPendingOperatorJobs(),
		countUnprocessedBillingWebhooks(),
		countOverdueComplianceRequests(),
		countRecentFailedHealthPings(),
	]);

	const signals: MaintenanceReadinessSignal[] = [
		{
			id: "live-tests",
			label: "Live tests in progress",
			count: liveInProgressTests,
			severity: severity(liveInProgressTests, 1, Number.POSITIVE_INFINITY),
			hint: "Students mid-test will lose progress on entry.",
			href: "/admin/assessments/live",
		},
		{
			id: "pending-jobs",
			label: "Pending operator jobs",
			count: pendingOperatorJobs,
			severity: severity(pendingOperatorJobs, 1, 25),
			hint: "Background work that hasn't finished yet.",
			href: "/admin/system/jobs",
		},
		{
			id: "billing-webhooks",
			label: "Unprocessed billing webhooks",
			count: unprocessedBillingWebhooks,
			severity: severity(unprocessedBillingWebhooks, 1, 10),
			hint: "Razorpay events awaiting processing.",
			href: "/admin/billing/events",
		},
		{
			id: "overdue-compliance",
			label: "Overdue compliance requests",
			count: overdueComplianceRequests,
			severity: severity(overdueComplianceRequests, 1, 1),
			hint: "DSR/COPPA requests past due — clear before maintenance.",
			href: "/admin/compliance/requests",
		},
		{
			id: "failed-health",
			label: "Failed health pings (1h)",
			count: recentFailedHealthPings,
			severity: severity(recentFailedHealthPings, 1, 5),
			hint: "Third-party providers degraded — investigate first.",
			href: "/admin/system/health",
		},
		{
			id: "active-admins",
			label: "Active admin sessions",
			count: activeAdminSessions,
			severity: "ok",
			hint: "Operators currently signed in (informational).",
			href: "/admin/system/active-sessions",
		},
	];

	return {
		envFlag,
		dbFlag,
		maintenanceActive: envFlag || dbFlag,
		signals,
		checkedAt: new Date().toISOString(),
	};
}
