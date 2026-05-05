import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { adminDetailResponse } from "@/lib/admin/response";
import { BULK_TRACKER_QUEUE, HEALTH_QUEUE, INTEGRITY_QUEUE } from "@/lib/jobs/queue-names";

export const runtime = "nodejs";

export async function GET() {
	return Sentry.withScope(async (scope) => {
		scope.setTag("feature", "admin");
		const gate = await requireAdminApi();
		if (gate instanceof NextResponse) return gate;

		const data = [
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

		return adminDetailResponse(data);
	});
}
