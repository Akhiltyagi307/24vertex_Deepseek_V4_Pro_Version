import * as Sentry from "@sentry/nextjs";

import { runReconciliation } from "@/lib/billing/reconcile";
import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
	const denied = assertCronRequestAuthorized(request);
	if (denied) return denied;

	try {
		const summary = await runReconciliation();
		return Response.json({ ok: true, summary });
	} catch (e) {
		Sentry.captureException(e, { tags: { component: "billing.reconcile", phase: "run" } });
		return Response.json({ success: false, ok: false, message: "Reconciliation failed." }, { status: 500 });
	}
}

export async function POST(request: Request): Promise<Response> {
	return handle(request);
}

export async function GET(request: Request): Promise<Response> {
	return handle(request);
}
