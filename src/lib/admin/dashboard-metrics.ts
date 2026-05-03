import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Single-row materialized view `admin_dashboard_metrics` (Phase 1 + Phase 8). */
export type AdminDashboardMetricsRow = {
	total_students: unknown;
	active_24h: unknown;
	tests_submitted_today: unknown;
	tests_in_progress: unknown;
	active_subscriptions: unknown;
	mrr_inr: unknown;
	pending_teacher_approvals: unknown;
	stuck_webhooks: unknown;
	open_dsrs: unknown;
	open_mod_flags: unknown;
	failed_jobs_24h: unknown;
	computed_at: unknown;
};

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetricsRow | null> {
	const rows = await db.execute(
		sql`SELECT * FROM admin_dashboard_metrics ORDER BY computed_at DESC LIMIT 1`,
	);
	const row = rows[0] as AdminDashboardMetricsRow | undefined;
	return row ?? null;
}

export function metricToNumber(v: unknown): number {
	if (v == null) return 0;
	if (typeof v === "bigint") return Number(v);
	if (typeof v === "number") return v;
	if (typeof v === "string") return Number(v) || 0;
	return Number(v) || 0;
}
