import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { runOperatorJobDrain } from "@/lib/jobs/process-operator-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;

	const { processed, stoppedForPause } = await runOperatorJobDrain({ maxJobs: 5 });
	return Response.json({ ok: true, processed, stopped_for_pause: stoppedForPause });
}

export async function POST(request: Request): Promise<Response> {
	return handle(request);
}

export async function GET(request: Request): Promise<Response> {
	return handle(request);
}
