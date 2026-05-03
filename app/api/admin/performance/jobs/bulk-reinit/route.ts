import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/admin/api-request-meta";
import { runBulkReinitTrackersByGrade, writeBulkReinitJob } from "@/lib/admin/bulk-reinit-job";
import { triggerOperatorJobsProcessInBackground } from "@/lib/admin/operator-worker-trigger";
import { insertOperatorJobQueued } from "@/lib/jobs/operator-job-mirror";
import { BULK_TRACKER_QUEUE } from "@/lib/jobs/queue-names";
import { logServerError } from "@/lib/server/log-supabase-error";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

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
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: adminHeaders() });
	}
	const parsed = bodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: adminHeaders() });
	}

	if (parsed.data.dry_run) {
		return NextResponse.json({ ok: true, dry_run: true, message: "Dry run not implemented; use grade without dry_run." }, { headers: adminHeaders() });
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
		return NextResponse.json(
			{ error: "Operator jobs table unavailable. Apply admin Phase 8 migration.", code: "jobs_table_missing" },
			{ status: 503, headers: adminHeaders() },
		);
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
		action: "performance_bulk_reinit",
		targetType: "bulk_job",
		targetId: jobId,
		payload: { grade },
		ipAddress: clientIpFromRequest(request),
		userAgent: userAgentFromRequest(request),
	});

	return NextResponse.json({ ok: true, job_id: jobId }, { headers: adminHeaders() });
}
