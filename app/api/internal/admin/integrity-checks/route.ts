import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { runAllIntegrityChecks } from "@/lib/admin/integrity/run-all-checks";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;

	await runAllIntegrityChecks();
	return Response.json({ ok: true });
}

export async function POST(request: Request): Promise<Response> {
	return handle(request);
}

export async function GET(request: Request): Promise<Response> {
	return handle(request);
}
