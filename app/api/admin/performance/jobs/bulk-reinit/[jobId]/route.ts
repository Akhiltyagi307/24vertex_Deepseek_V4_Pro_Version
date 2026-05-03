import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { readBulkReinitJob, type BulkReinitJobState } from "@/lib/admin/bulk-reinit-job";
import { db } from "@/db";
import { operatorJobs } from "@/db/schema/operator-jobs";

export const runtime = "nodejs";

function adminHeaders(): HeadersInit {
	return { "X-Robots-Tag": "noindex, nofollow" };
}

export async function GET(_request: Request, ctx: { params: Promise<{ jobId: string }> }) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	const { jobId } = await ctx.params;
	const kv = await readBulkReinitJob(jobId);
	const jobRows = await db.select().from(operatorJobs).where(eq(operatorJobs.id, jobId)).limit(1);
	const mirror = jobRows[0];

	let state: BulkReinitJobState | null = kv;
	if (!state && mirror?.payload && typeof mirror.payload === "object" && mirror.payload !== null) {
		const grade = (mirror.payload as { grade?: number }).grade ?? 0;
		const mapStatus = (s: string): BulkReinitJobState["status"] => {
			if (s === "active") return "running";
			if (s === "completed") return "done";
			if (s === "failed") return "failed";
			return "queued";
		};
		const res =
			mirror.result && typeof mirror.result === "object" && mirror.result !== null ?
				(mirror.result as { grade?: number; processed?: number; total?: number })
			:	null;
		state = {
			status: mapStatus(mirror.status),
			processed: res?.processed ?? 0,
			total: res?.total ?? 0,
			grade: res?.grade ?? grade,
			...(mirror.error ? { error: mirror.error } : {}),
		};
	}

	if (!state) {
		return NextResponse.json({ error: "Job not found" }, { status: 404, headers: adminHeaders() });
	}
	return NextResponse.json({ data: state, operator_job: mirror ?? null }, { headers: adminHeaders() });
}
