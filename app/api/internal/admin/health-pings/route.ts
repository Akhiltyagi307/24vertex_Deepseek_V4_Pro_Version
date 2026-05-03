import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { runAllHealthPings } from "@/lib/jobs/health/run-all-health-pings";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(request: Request): Promise<Response> {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;

	await runAllHealthPings();
	return Response.json({ ok: true });
}

export async function POST(request: Request): Promise<Response> {
	return handle(request);
}

export async function GET(request: Request): Promise<Response> {
	return handle(request);
}
