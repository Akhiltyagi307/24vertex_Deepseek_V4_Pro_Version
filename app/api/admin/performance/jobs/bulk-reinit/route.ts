import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { adminAckResponse, adminErrorResponse } from "@/lib/admin/response";
import { runBulkReinitTrackersByGrade, writeBulkReinitJob } from "@/lib/admin/bulk-reinit-job";
import { triggerOperatorJobsProcessInBackground } from "@/lib/admin/operator-worker-trigger";
import { insertOperatorJobQueued } from "@/lib/jobs/operator-job-mirror";
import { BULK_TRACKER_QUEUE } from "@/lib/jobs/queue-names";
import { logServerError } from "@/lib/server/log-supabase-error";

export const runtime = "nodejs";

const bodySchema = z.object({
	grade: z.number().int().min(1).max(12),
	dry_run: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return adminErrorResponse("Invalid JSON");
	}
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) return adminErrorResponse("Invalid body");

	if (parsed.data.dry_run) {
		return adminAckResponse({
			dry_run: true,
			message: "Dry run not implemented; use grade without dry_run.",
		});
	}

	const jobId = randomUUID();
	const grade = parsed.data.grade;

	try {
		await insertOperatorJobQueued({
			id: jobId,
			queue: BULK_TRACKER_QUEUE,
			name: "reinit-by-grade",
			payload: { grade },
			triggeredBy: "admin",
		});
	} catch (e) {
		logServerError("bulk-reinit.insert_operator_job", e, { jobId });
		return adminErrorResponse("Operator jobs table unavailable. Apply admin Phase 8 migration.", {
			status: 503,
			code: "jobs_table_missing",
		});
	}

	await writeBulkReinitJob(jobId, {
		status: "queued",
		processed: 0,
		total: 0,
		grade,
	});

	const triggered = await triggerOperatorJobsProcessInBackground();
	if (!triggered.ok) {
		void runBulkReinitTrackersByGrade(jobId, grade, { operatorJobId: jobId }).catch((e) => {
			logServerError("bulk-reinit.background", e, { jobId });
		});
	}

	await writeAdminAction({
		action: ADMIN_ACTIONS.PERFORMANCE_BULK_REINIT,
		targetType: "bulk_job",
		targetId: jobId,
		payload: { grade },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return adminAckResponse({ job_id: jobId });
}
