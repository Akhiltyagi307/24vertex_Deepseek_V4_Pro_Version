import "server-only";

import { BULK_TRACKER_QUEUE, HEALTH_QUEUE, INTEGRITY_QUEUE } from "@/lib/jobs/queue-names";

/** Queues surfaced on `/admin/system/jobs/queues` (pause/resume). */
export const ADMIN_OPERATOR_QUEUE_NAMES = [BULK_TRACKER_QUEUE, HEALTH_QUEUE, INTEGRITY_QUEUE] as const;

export function isAdminOperatorQueueName(queue: string): queue is (typeof ADMIN_OPERATOR_QUEUE_NAMES)[number] {
	return (ADMIN_OPERATOR_QUEUE_NAMES as readonly string[]).includes(queue);
}

export type AdminJobScheduleRow = {
	id: string;
	queue: string;
	name: string;
	interval_ms: number;
	description: string;
};

/** Static pg_cron schedule metadata (mirrors GET /api/admin/jobs/schedules). */
export function getAdminJobSchedules(): AdminJobScheduleRow[] {
	return [
		{
			id: "operator-process-jobs-every-5m",
			queue: BULK_TRACKER_QUEUE,
			name: "drain-queued",
			interval_ms: 300_000,
			description:
				"Supabase pg_cron `*/5 * * * *` → `/api/internal/admin/process-operator-jobs` (Vault `cron_secret` Bearer)",
		},
		{
			id: "operator-health-pings-every-2h",
			queue: HEALTH_QUEUE,
			name: "run-all",
			interval_ms: 2 * 60 * 60 * 1000,
			description:
				"Supabase pg_cron `15 */2 * * *` → `/api/internal/admin/health-pings` (Vault `cron_secret` Bearer)",
		},
		{
			id: "operator-integrity-checks-daily",
			queue: INTEGRITY_QUEUE,
			name: "run-all",
			interval_ms: 86_400_000,
			description:
				"Supabase pg_cron `0 4 * * *` → `/api/internal/admin/integrity-checks` (Vault `cron_secret` Bearer)",
		},
		{
			id: "practice-metrics-daily",
			queue: "practice",
			name: "metrics-rollup",
			interval_ms: 86_400_000,
			description:
				"Supabase pg_cron `15 2 * * *` → `/api/internal/practice/metrics` (Vault `cron_secret` Bearer)",
		},
		{
			id: "admin-weekly-digest-monday",
			queue: "admin",
			name: "weekly-digest",
			interval_ms: 7 * 86_400_000,
			description:
				"Supabase pg_cron `30 3 * * 1` → `/api/internal/admin/weekly-digest` (Vault `cron_secret` Bearer)",
		},
	];
}

export function formatScheduleInterval(ms: number): string {
	if (ms >= 86_400_000 && ms % 86_400_000 === 0) {
		const days = ms / 86_400_000;
		return days === 1 ? "Daily" : `Every ${days} days`;
	}
	if (ms >= 3_600_000 && ms % 3_600_000 === 0) {
		const hours = ms / 3_600_000;
		return hours === 1 ? "Hourly" : `Every ${hours} hours`;
	}
	if (ms >= 60_000 && ms % 60_000 === 0) {
		const minutes = ms / 60_000;
		return minutes === 1 ? "Every minute" : `Every ${minutes} minutes`;
	}
	return `${ms} ms`;
}
