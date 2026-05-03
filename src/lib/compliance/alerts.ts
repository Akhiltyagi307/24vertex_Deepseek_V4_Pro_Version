import "server-only";

import { and, inArray, isNotNull, lte } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";

import { db } from "@/db";
import { complianceRequests } from "@/db/schema/compliance-requests";

/**
 * Emits a low-volume Sentry signal when open DSRs are near or past statutory deadline (PDR §4.23).
 * Safe to call from list APIs (rate-limit via daily key in admin_runtime_kv optional later).
 */
export async function captureOpenComplianceDeadlineRisk(): Promise<void> {
	const soon = new Date();
	soon.setUTCDate(soon.getUTCDate() + 7);

	const rows = await db
		.select({ id: complianceRequests.id, dueAt: complianceRequests.dueAt, status: complianceRequests.status })
		.from(complianceRequests)
		.where(
			and(
				inArray(complianceRequests.status, ["open", "in_progress"]),
				isNotNull(complianceRequests.dueAt),
				lte(complianceRequests.dueAt, soon),
			)!,
		)
		.limit(50);

	if (!rows.length) return;

	Sentry.addBreadcrumb({
		category: "compliance",
		message: "open_dsr_deadline_window",
		level: "warning",
		data: { count: rows.length, ids: rows.map((r) => r.id) },
	});

	if (rows.some((r) => r.dueAt && r.dueAt < new Date())) {
		Sentry.captureMessage(`Compliance: ${rows.length} open DSR(s) at or past due date`, "warning");
	}
}
